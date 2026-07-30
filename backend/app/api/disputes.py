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
    Auth: admin only. Body: {resolution, refund_amount?, approve?}
    Sets resolution_notes, resolved_at, resolved_by, and status —
    'resolved' for an approval, 'dismissed' for a decline.

    **This endpoint moves money for one issue_type.** A `cancellation_refund` is
    opened by bookings.py::cancel_booking when a job is cancelled after proof of
    work exists; the client's share sits in `escrow_held` until an admin decides,
    having reviewed the before/after photos and the voice memo (Kira's ruling,
    2026-07-30). Approving refunds it; declining hands it to the business. Every
    other issue_type resolves as pure record-keeping, exactly as before.

    Resolving twice is a 409 — the second decision would pay out again.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.supabase_client import supabase
from app.services import escrow, refunds
from app.services.audit import record_audit

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

# System-opened only, by bookings.py::cancel_booking. Deliberately absent from
# VALID_ISSUE_TYPES above so POST /disputes/ refuses it: a client must not be able
# to open a refund request against a booking they never cancelled, because the
# request is what decides where held escrow goes.
CANCELLATION_REFUND = "cancellation_refund"


class DisputeCreate(BaseModel):
    booking_id: str
    issue_type: str = Field(..., min_length=1)
    description: str = Field(..., min_length=10, max_length=2000)


class DisputeResolve(BaseModel):
    resolution: str = Field(..., min_length=1, max_length=1000)
    refund_amount: float | None = None
    # Only meaningful for a cancellation_refund. True (the default) approves and
    # pays the client; False declines and hands the held amount to the business.
    # An ordinary dispute ignores it — resolving one of those has never moved
    # money and still does not.
    approve: bool = True


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
        raise HTTPException(
            status_code=400,
            detail=f"issue_type must be one of {sorted(VALID_ISSUE_TYPES)}",
        )

    booking = _load_booking_for_auth(body.booking_id, current_user)

    existing = (
        supabase.table("disputes")
        .select("id, status")
        .eq("booking_id", body.booking_id)
        .in_("status", ["open", "under_review"])
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409, detail="Booking already has an open dispute"
        )

    row = {
        "booking_id": body.booking_id,
        "opened_by": current_user["id"],
        "against_party": (
            "business" if booking["client_id"] == current_user["id"] else "client"
        ),
        "issue_type": body.issue_type,
        "description": body.description.strip(),
        "status": "open",
    }
    created = supabase.table("disputes").insert(row).execute()
    dispute = (created.data or [None])[0]
    if not dispute:
        raise HTTPException(status_code=500, detail="Could not open dispute")

    try:
        supabase.table("booking_events").insert(
            {
                "booking_id": body.booking_id,
                "actor_id": current_user["id"],
                "event_type": "dispute_opened",
                "note": f"[{body.issue_type}] {body.description[:200]}",
            }
        ).execute()
    except Exception as e:
        logger.warning(
            "booking_event write failed for dispute %s: %s", dispute.get("id"), e
        )

    return dispute


@router.get("/mine")
def list_my_disputes(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]

    filed = (
        supabase.table("disputes")
        .select(
            "*, bookings(id, client_id, business_id, service_category, scheduled_date:confirmed_date)"
        )
        .eq("opened_by", uid)
        .order("created_at", desc=True)
        .execute()
    )
    items = list(filed.data or [])

    if current_user.get("role") == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if biz.data:
            biz_bookings = (
                supabase.table("bookings")
                .select("id")
                .eq("business_id", biz.data["id"])
                .execute()
            )
            biz_ids = [b["id"] for b in (biz_bookings.data or [])]
            if biz_ids:
                against = (
                    supabase.table("disputes")
                    .select(
                        "*, bookings(id, client_id, business_id, service_category, scheduled_date:confirmed_date)"
                    )
                    .in_("booking_id", biz_ids)
                    .neq("opened_by", uid)
                    .order("created_at", desc=True)
                    .execute()
                )
                items.extend(against.data or [])

    return {"items": items, "count": len(items)}


@router.get("/admin/queue")
def admin_dispute_queue(current_user: dict = Depends(get_current_user)):
    """Everything awaiting an admin decision, newest first.

    Literal path, so it cannot be shadowed by /{dispute_id}. Carries the money and
    the counterparties inline: the review screen should not have to fan out a
    request per row just to render a list.

    `held_amount` comes from the ledger, not from `refund_amount` — the latter is
    what was proposed at cancellation time, and the ledger is what actually has
    money behind it now.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    res = (
        supabase.table("disputes")
        .select(
            "*, bookings(id, client_id, business_id, service_category, "
            "total_amount, confirmed_date, status, "
            "businesses(business_name, logo_url), "
            "service_posts(title, address))"
        )
        .in_("status", ["open", "under_review"])
        .order("created_at", desc=True)
        .execute()
    )

    items = []
    for row in res.data or []:
        held = 0.0
        # Only a cancellation refund has money parked against it; asking the ledger
        # about an ordinary complaint would be noise.
        if row.get("issue_type") == CANCELLATION_REFUND:
            try:
                payment = escrow.load_single_payment(row["booking_id"])
                held = escrow.to_dollars(escrow.money_cents(payment, "escrow_held"))
            except Exception:
                logger.exception(
                    "could not read held escrow for dispute %s", row.get("id")
                )
        row["held_amount"] = held
        row["needs_money_decision"] = (
            row.get("issue_type") == CANCELLATION_REFUND and held > 0
        )
        items.append(row)

    # Requests with money waiting outrank record-keeping complaints.
    items.sort(key=lambda r: (not r["needs_money_decision"], r.get("created_at") or ""))
    return {"items": items, "count": len(items)}


def _settle_cancellation_refund(
    *,
    booking_id: str,
    approve: bool,
    requested_amount: float | None,
    actor_id: str,
) -> int:
    """Move the money a cancellation refund request was holding. Returns cents moved.

    `cancel_booking` parked the client's share in `escrow_held` and sent nothing to
    Stripe. That held figure is the entire subject of the request, so it is read
    from the ledger here rather than trusted from the request body — the ledger is
    what actually has money behind it.

    Approve -> refund the client (Stripe, then ledger, via the idempotent helper).
    Decline -> the same figure crosses to the business; nothing goes to Stripe.
    """
    payment = escrow.load_single_payment(booking_id)
    if not payment:
        # Nothing was ever collected (the common beta case). The decision is still
        # recorded; there is simply no money to move.
        return 0

    held_c = escrow.money_cents(payment, "escrow_held")
    if held_c <= 0:
        return 0

    # An admin may refund LESS than is held (a partial goodwill outcome) but never
    # more — the extra would not exist.
    move_c = held_c
    if approve and requested_amount is not None:
        asked_c = escrow.to_cents(requested_amount)
        move_c = max(0, min(held_c, asked_c))
    if move_c <= 0:
        return 0

    if approve:
        try:
            refunds.refund_payment_row(
                payment,
                amount_cents=move_c,
                reason=refunds.REASON_CANCELLATION_APPROVED,
                actor_id=actor_id,
            )
        except refunds.RefundNotPossible as exc:
            # No captured intent: ledger-only, so clear the hold without pretending
            # Stripe reversed anything. Same shape as the cancel path's
            # "ledger-only refund" branch.
            logger.info(
                "cancellation refund approved for booking %s but nothing to "
                "reverse at Stripe (%s) — clearing the hold in the ledger only",
                booking_id,
                exc,
            )
            cleared = escrow.ledger_write(
                escrow_held=held_c - move_c,
                released_to_business=escrow.money_cents(
                    payment, "released_to_business"
                ),
                platform_cut=escrow.money_cents(payment, "platform_cut"),
            )
            cleared["status"] = "refunded"
            supabase.table("payments").update(cleared).eq("id", payment["id"]).execute()
        return move_c

    # DECLINED. The held share becomes the business's, on top of whatever the
    # ladder already gave them. No Stripe call — the money was captured long ago
    # and is simply being allocated.
    declined = escrow.ledger_write(
        escrow_held=held_c - move_c,
        released_to_business=escrow.money_cents(payment, "released_to_business")
        + move_c,
        platform_cut=escrow.money_cents(payment, "platform_cut"),
    )
    declined["status"] = "fully_released"
    declined["released_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("payments").update(declined).eq("id", payment["id"]).execute()
    return move_c


@router.patch("/{dispute_id}/resolve")
def resolve_dispute(
    dispute_id: str,
    body: DisputeResolve,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    # Load BEFORE writing. This used to blind-update and inspect the result, which
    # was fine while resolving moved no money — it cannot stay that way now that a
    # cancellation_refund's outcome decides where held escrow goes.
    existing = (
        supabase.table("disputes")
        .select("id, booking_id, issue_type, status, refund_amount")
        .eq("id", dispute_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Dispute not found")
    dispute = existing.data

    if dispute["status"] in ("resolved", "dismissed"):
        # Money already moved once. Deciding twice would refund twice.
        raise HTTPException(
            status_code=409,
            detail=f"This dispute is already {dispute['status']}",
        )

    is_cancellation = dispute["issue_type"] == CANCELLATION_REFUND
    moved_cents = 0

    if is_cancellation:
        moved_cents = _settle_cancellation_refund(
            booking_id=dispute["booking_id"],
            approve=body.approve,
            requested_amount=body.refund_amount,
            actor_id=current_user["id"],
        )

    now = datetime.now(timezone.utc).isoformat()
    # 'dismissed' is the decline. Both values already pass disputes_status_check.
    final_status = "dismissed" if (is_cancellation and not body.approve) else "resolved"
    updated = (
        supabase.table("disputes")
        .update(
            {
                "status": final_status,
                "resolution_notes": body.resolution.strip(),
                # For a cancellation this records what ACTUALLY moved, not what was
                # asked for — the two differ when the request is capped by what is
                # still held, and the ledger is the thing worth believing later.
                "refund_amount": (
                    escrow.to_dollars(moved_cents)
                    if is_cancellation
                    else body.refund_amount
                ),
                "resolved_at": now,
                "resolved_by": current_user["id"],
            }
        )
        .eq("id", dispute_id)
        .execute()
    )
    row = (updated.data or [None])[0]
    if not row:
        raise HTTPException(status_code=404, detail="Dispute not found")

    try:
        supabase.table("booking_events").insert(
            {
                "booking_id": row["booking_id"],
                "actor_id": current_user["id"],
                "event_type": "dispute_resolved",
                "note": body.resolution[:200],
            }
        ).execute()
    except Exception as e:
        logger.warning(
            "booking_event write failed for dispute resolve %s: %s", dispute_id, e
        )

    record_audit(
        actor_id=current_user["id"],
        action="dispute.resolve",
        resource_type="dispute",
        resource_id=dispute_id,
        metadata={"refund_amount": body.refund_amount},
        request=request,
    )

    return row
