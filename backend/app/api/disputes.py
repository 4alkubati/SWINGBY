"""
disputes.py — F2 (audit 2026-07-01). Booking disputes.

Endpoints
---------
POST /disputes/
    Auth: booking's client OR business owner.
    Body: {booking_id, issue_type, description}
    Creates a dispute row (status='open') and a booking_events row so the
    timeline reflects the escalation.

GET /disputes/mine
    Auth: any signed-in user. Returns disputes the caller filed OR received.

PATCH /disputes/{dispute_id}/resolve
    Auth: admin only. Body: {resolution, refund_amount?}
    Sets status='resolved', resolved_at, resolution_notes.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_ISSUE_TYPES = {
    "no_show",
    "poor_quality",
    "damage",
    "overcharge",
    "safety",
    "other",
}


class DisputeCreate(BaseModel):
    booking_id: str
    issue_type: str = Field(..., min_length=1)
    description: str = Field(..., min_length=10, max_length=2000)


class DisputeResolve(BaseModel):
    resolution: str = Field(..., min_length=1, max_length=1000)
    refund_amount: float | None = None


def _load_booking_for_auth(booking_id: str, current_user: dict) -> dict:
    b = (
        supabase.table("bookings")
        .select("id, client_id, business_id")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not b.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = b.data

    uid = current_user["id"]
    role = current_user.get("role")
    is_client = booking["client_id"] == uid
    is_owner = False
    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("owner_id")
            .eq("id", booking["business_id"])
            .single()
            .execute()
        )
        is_owner = bool(biz.data) and biz.data["owner_id"] == uid
    if not (is_client or is_owner):
        raise HTTPException(status_code=403, detail="Not a party to this booking")

    return booking


@router.post("/")
def create_dispute(body: DisputeCreate, current_user: dict = Depends(get_current_user)):
    if body.issue_type not in VALID_ISSUE_TYPES:
        raise HTTPException(status_code=400, detail=f"issue_type must be one of {sorted(VALID_ISSUE_TYPES)}")

    booking = _load_booking_for_auth(body.booking_id, current_user)

    existing = (
        supabase.table("disputes")
        .select("id, status")
        .eq("booking_id", body.booking_id)
        .in_("status", ["open", "under_review"])
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Booking already has an open dispute")

    row = {
        "booking_id": body.booking_id,
        "opened_by": current_user["id"],
        "against_party": "business" if booking["client_id"] == current_user["id"] else "client",
        "issue_type": body.issue_type,
        "description": body.description.strip(),
        "status": "open",
    }
    created = supabase.table("disputes").insert(row).execute()
    dispute = (created.data or [None])[0]
    if not dispute:
        raise HTTPException(status_code=500, detail="Could not open dispute")

    try:
        supabase.table("booking_events").insert({
            "booking_id": body.booking_id,
            "event_type": "dispute_opened",
            "note": f"[{body.issue_type}] {body.description[:200]}",
        }).execute()
    except Exception as e:
        logger.warning("booking_event write failed for dispute %s: %s", dispute.get("id"), e)

    return dispute


@router.get("/mine")
def list_my_disputes(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]

    filed = (
        supabase.table("disputes")
        .select("*, bookings(id, client_id, business_id, service_category, scheduled_date)")
        .eq("opened_by", uid)
        .order("created_at", desc=True)
        .execute()
    )
    items = list(filed.data or [])

    if current_user.get("role") == "business_owner":
        biz = supabase.table("businesses").select("id").eq("owner_id", uid).single().execute()
        if biz.data:
            biz_bookings = supabase.table("bookings").select("id").eq("business_id", biz.data["id"]).execute()
            biz_ids = [b["id"] for b in (biz_bookings.data or [])]
            if biz_ids:
                against = (
                    supabase.table("disputes")
                    .select("*, bookings(id, client_id, business_id, service_category, scheduled_date)")
                    .in_("booking_id", biz_ids)
                    .neq("opened_by", uid)
                    .order("created_at", desc=True)
                    .execute()
                )
                items.extend(against.data or [])

    return {"items": items, "count": len(items)}


@router.patch("/{dispute_id}/resolve")
def resolve_dispute(
    dispute_id: str,
    body: DisputeResolve,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.now(timezone.utc).isoformat()
    updated = (
        supabase.table("disputes")
        .update({
            "status": "resolved",
            "resolution_notes": body.resolution.strip(),
            "refund_amount": body.refund_amount,
            "resolved_at": now,
            "resolved_by": current_user["id"],
        })
        .eq("id", dispute_id)
        .execute()
    )
    row = (updated.data or [None])[0]
    if not row:
        raise HTTPException(status_code=404, detail="Dispute not found")

    try:
        supabase.table("booking_events").insert({
            "booking_id": row["booking_id"],
            "event_type": "dispute_resolved",
            "note": body.resolution[:200],
        }).execute()
    except Exception as e:
        logger.warning("booking_event write failed for dispute resolve %s: %s", dispute_id, e)

    return row
