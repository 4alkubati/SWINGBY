"""
proof_of_work.py — LANE 5. The proof bundle that closes the escrow loop.

Spec: design/handoff-jet-pulse/PROOF-REQUEST-WEB-AUTOBID.md §1
Walkthrough items: M5 (client photos pre-fill BEFORE), M6 (voice memo).

The business captures BEFORE/AFTER photos plus an optional 60 s voice memo and
taps "Send for approval". The client reviews and either approves — which
releases escrow to the business — or raises an issue, which leaves the funds
held and hands off to the dispute flow.

Endpoints (mounted under /bookings)
-----------------------------------
GET    /bookings/{id}/proof                one bundle: client photos, business
                                           before/after, voice note, status,
                                           and the exact release amount.
PUT    /bookings/{id}/proof/voice-note     record / re-record (replaces).
DELETE /bookings/{id}/proof/voice-note     drop the memo.
POST   /bookings/{id}/proof/submit         provider: send for approval.
POST   /bookings/{id}/proof/approve        client: approve → release escrow.
POST   /bookings/{id}/proof/decline        client: something's wrong → funds
                                           stay held, caller opens a dispute.

Photo UPLOADS reuse the existing POST /bookings/{id}/photos in
``booking_photos.py`` — no second write path for the same table.

Why the 2 + 2 minimum is enforced HERE and not only in the UI
------------------------------------------------------------
"Send for approval" is the last gate before money moves. A client-supplied
photo must never satisfy it, so the count only ever considers rows with
``source = 'business'`` (migration 20260724090000).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.services import escrow
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()

# Spec §1: "Disabled until 2 before + 2 after photos exist."
MIN_BEFORE = 2
MIN_AFTER = 2
MAX_VOICE_NOTE_SECONDS = 60


# ---------------------------------------------------------------------------
# Payloads
# ---------------------------------------------------------------------------


class VoiceNoteIn(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    path: str = Field(..., min_length=1, max_length=512)
    duration_seconds: int = Field(..., ge=1, le=MAX_VOICE_NOTE_SECONDS)


# ---------------------------------------------------------------------------
# Loading + authorisation (mirrors booking_photos.py so the two agree)
# ---------------------------------------------------------------------------


def _load_booking(booking_id: str) -> dict:
    res = (
        supabase.table("bookings")
        .select(
            "id, client_id, business_id, employee_id, post_id, status, "
            "service_category, confirmed_date"
        )
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    return res.data


def _is_provider(booking: dict, current_user: dict) -> bool:
    uid = current_user["id"]
    role = current_user["role"]

    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if biz.data and biz.data["id"] == booking["business_id"]:
            return True

    if role == "employee":
        emp = (
            supabase.table("employees")
            .select("id")
            .eq("user_id", uid)
            .single()
            .execute()
        )
        if emp.data and emp.data["id"] == booking.get("employee_id"):
            return True

    return False


def _is_client(booking: dict, current_user: dict) -> bool:
    return booking["client_id"] == current_user["id"]


def _is_party(booking: dict, current_user: dict) -> bool:
    return _is_client(booking, current_user) or _is_provider(booking, current_user)


def _require_party(booking: dict, current_user: dict) -> None:
    if not _is_party(booking, current_user):
        raise HTTPException(status_code=403, detail="Access denied")


def _require_provider(booking: dict, current_user: dict) -> None:
    if not _is_provider(booking, current_user):
        raise HTTPException(
            status_code=403,
            detail="Only the assigned business owner or employee can do that",
        )


def _require_client(booking: dict, current_user: dict) -> None:
    if not _is_client(booking, current_user):
        raise HTTPException(
            status_code=403, detail="Only the client on this booking can do that"
        )


# ---------------------------------------------------------------------------
# Proof row helpers
# ---------------------------------------------------------------------------


def _load_proof(booking_id: str) -> Optional[dict]:
    try:
        res = (
            supabase.table("booking_proofs")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        return res.data
    except Exception:
        # PostgREST .single() raises when there is no row. A missing proof row
        # is the normal "draft, nothing captured yet" state, not an error.
        return None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _upsert_proof(booking_id: str, patch: dict) -> dict:
    existing = _load_proof(booking_id)
    patch = {**patch, "updated_at": _now_iso()}
    if existing:
        res = (
            supabase.table("booking_proofs")
            .update(patch)
            .eq("booking_id", booking_id)
            .execute()
        )
        return (res.data or [{**existing, **patch}])[0]
    res = (
        supabase.table("booking_proofs")
        .insert({"booking_id": booking_id, **patch})
        .execute()
    )
    return (res.data or [{"booking_id": booking_id, **patch}])[0]


def _photos(booking_id: str) -> list[dict]:
    res = (
        supabase.table("booking_photos")
        .select("*")
        .eq("booking_id", booking_id)
        .order("created_at", desc=False)
        .execute()
    )
    return res.data or []


def _voice_note(booking_id: str) -> Optional[dict]:
    try:
        res = (
            supabase.table("booking_voice_notes")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        return res.data
    except Exception:
        return None


def _client_supplied_photos(booking: dict) -> list[str]:
    """The client's own job-post photos — walkthrough M5.

    These pre-populate the BEFORE column labelled "from your job post". They are
    NOT booking_photos rows and never count toward the 2 + 2 minimum: the point
    of proof-of-work is what the *business* recorded on site.
    """
    post_id = booking.get("post_id")
    if not post_id:
        return []
    try:
        res = (
            supabase.table("service_posts")
            .select("image_urls")
            .eq("id", post_id)
            .single()
            .execute()
        )
    except Exception:
        return []
    urls = (res.data or {}).get("image_urls") or []
    return [u for u in urls if u]


def counts(photos: list[dict]) -> dict:
    """Business-captured counts only. Pure function — unit tested directly."""
    before = sum(
        1
        for p in photos
        if p.get("phase") == "before" and (p.get("source") or "business") == "business"
    )
    after = sum(
        1
        for p in photos
        if p.get("phase") == "after" and (p.get("source") or "business") == "business"
    )
    return {
        "before": before,
        "after": after,
        "before_needed": max(MIN_BEFORE - before, 0),
        "after_needed": max(MIN_AFTER - after, 0),
        "can_submit": before >= MIN_BEFORE and after >= MIN_AFTER,
    }


def release_preview(payment: Optional[dict]) -> dict:
    """What approving would actually move, in integer cents.

    The client's screen names this amount before an irreversible action, so it
    has to be the real ledger number rather than the booking total.
    """
    if not payment:
        return {"release_cents": 0, "total_cents": 0, "already_released_cents": 0}
    total_c = escrow.money_cents(payment, "total_charged")
    cut_c = escrow.money_cents(payment, "platform_cut")
    already_c = escrow.money_cents(payment, "released_to_business")
    split = escrow.compute_completion_release_cents(total_c, cut_c, already_c)
    return {
        "release_cents": split["final_release_cents"],
        "total_cents": total_c,
        "already_released_cents": already_c,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/{booking_id}/proof")
def get_proof(booking_id: str, current_user: dict = Depends(get_current_user)):
    """One round-trip for both proof screens."""
    booking = _load_booking(booking_id)
    _require_party(booking, current_user)

    photos = _photos(booking_id)
    proof = _load_proof(booking_id) or {"status": "draft"}
    payment = escrow.load_single_payment(booking_id)

    business_name = None
    try:
        biz = (
            supabase.table("businesses")
            .select("business_name")
            .eq("id", booking["business_id"])
            .single()
            .execute()
        )
        business_name = (biz.data or {}).get("business_name")
    except Exception:
        logger.warning("could not resolve business name for booking %s", booking_id)

    return {
        "booking_id": booking_id,
        "status": proof.get("status", "draft"),
        "submitted_at": proof.get("submitted_at"),
        "approved_at": proof.get("approved_at"),
        "business_name": business_name,
        "service_category": booking.get("service_category"),
        "client_photos": _client_supplied_photos(booking),
        "before": [p for p in photos if p.get("phase") == "before"],
        "after": [p for p in photos if p.get("phase") == "after"],
        "voice_note": _voice_note(booking_id),
        "counts": counts(photos),
        "release": release_preview(payment),
        "min_before": MIN_BEFORE,
        "min_after": MIN_AFTER,
    }


@router.put("/{booking_id}/proof/voice-note")
def put_voice_note(
    booking_id: str,
    body: VoiceNoteIn,
    current_user: dict = Depends(get_current_user),
):
    """Record or re-record the memo. One per booking — this REPLACES."""
    booking = _load_booking(booking_id)
    _require_provider(booking, current_user)

    row = {
        "booking_id": booking_id,
        "recorded_by": current_user["id"],
        "url": body.url,
        "path": body.path,
        "duration_seconds": body.duration_seconds,
    }
    try:
        res = (
            supabase.table("booking_voice_notes")
            .upsert(row, on_conflict="booking_id")
            .execute()
        )
        return (res.data or [row])[0]
    except Exception:
        logger.exception("could not save voice note for booking %s", booking_id)
        raise HTTPException(status_code=400, detail="Could not save the voice note")


@router.delete("/{booking_id}/proof/voice-note")
def delete_voice_note(booking_id: str, current_user: dict = Depends(get_current_user)):
    booking = _load_booking(booking_id)
    _require_provider(booking, current_user)
    supabase.table("booking_voice_notes").delete().eq(
        "booking_id", booking_id
    ).execute()
    return {"deleted": True, "booking_id": booking_id}


@router.post("/{booking_id}/proof/submit")
def submit_proof(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Provider sends the proof for approval.

    The voice memo is deliberately NOT part of the gate — spec §1: "Never block
    the CTA on the voice memo."
    """
    booking = _load_booking(booking_id)
    _require_provider(booking, current_user)

    existing = _load_proof(booking_id)
    if existing and existing.get("status") == "approved":
        raise HTTPException(
            status_code=409, detail="This work has already been approved"
        )

    c = counts(_photos(booking_id))
    if not c["can_submit"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Add {c['before_needed']} more before and {c['after_needed']} more "
                f"after photo(s) before sending for approval"
            ),
        )

    proof = _upsert_proof(
        booking_id,
        {
            "status": "submitted",
            "submitted_by": current_user["id"],
            "submitted_at": _now_iso(),
        },
    )
    return {"proof": proof, "counts": c}


@router.post("/{booking_id}/proof/approve")
def approve_proof(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Client approves — escrow releases to the business. Irreversible.

    Ordering matters: release the ledger FIRST, then mark the proof approved.
    If the release raises (no capture behind the money — escrow's FINDING C
    guard) nothing is marked approved and the client can try again or dispute.
    """
    booking = _load_booking(booking_id)
    _require_client(booking, current_user)

    proof = _load_proof(booking_id)
    if not proof or proof.get("status") == "draft":
        raise HTTPException(
            status_code=409, detail="The business hasn't sent proof for approval yet"
        )
    if proof.get("status") == "approved":
        # Idempotent: a double-tap must not double-release.
        return {"proof": proof, "outcome": "already_approved"}
    if proof.get("status") == "disputed":
        raise HTTPException(
            status_code=409,
            detail="This job is disputed — funds stay held until it is resolved",
        )

    try:
        outcome = escrow.release_escrow_on_complete(booking_id)
    except escrow.CaptureRequiredError as exc:
        logger.error("approve blocked, money was never captured: %s", exc)
        raise HTTPException(
            status_code=409,
            detail=(
                "We can't release this payment — the charge was never captured. "
                "Contact support before approving."
            ),
        )
    except escrow.EscrowError as exc:
        logger.error("approve blocked for booking %s: %s", booking_id, exc)
        raise HTTPException(status_code=409, detail=str(exc))

    updated = _upsert_proof(
        booking_id, {"status": "approved", "approved_at": _now_iso()}
    )

    # The booking row itself is owned by bookings.py (Lane 1); mirror the
    # completion here rather than reaching into that module.
    try:
        supabase.table("bookings").update(
            {"status": "completed", "payment_status": "fully_released"}
        ).eq("id", booking_id).execute()
    except Exception:
        logger.exception(
            "escrow released for %s but the bookings row did not update", booking_id
        )

    try:
        supabase.table("booking_events").insert(
            {
                "booking_id": booking_id,
                "actor_id": current_user["id"],
                "event_type": "completed",
                "note": "Client approved the proof of work — payment released",
            }
        ).execute()
    except Exception as exc:
        logger.warning("booking_event write failed after approve: %s", exc)

    return {
        "proof": updated,
        "outcome": outcome.get("outcome"),
        "payment": outcome.get("payment"),
    }


@router.post("/{booking_id}/proof/decline")
def decline_proof(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Client taps "Something's wrong".

    Marks the proof disputed so nothing can release, and returns — the mobile
    app then pushes DisputeFlowScreen, which owns the actual dispute record.
    Money is untouched: it stays exactly where it is, held.
    """
    booking = _load_booking(booking_id)
    _require_client(booking, current_user)

    proof = _load_proof(booking_id)
    if proof and proof.get("status") == "approved":
        raise HTTPException(
            status_code=409,
            detail="This work was already approved and the payment released",
        )

    updated = _upsert_proof(
        booking_id, {"status": "disputed", "disputed_at": _now_iso()}
    )
    return {"proof": updated, "funds_held": True}
