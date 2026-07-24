from fastapi import APIRouter, HTTPException, Depends
from app.deps import get_current_user
from app.supabase_client import supabase
from app.services import escrow

router = APIRouter()


def _can_view_payment(booking: dict, current_user: dict) -> bool:
    """Returns True if the current user is the client or the business owner."""
    if booking["client_id"] == current_user["id"]:
        return True
    if current_user["role"] == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
        if biz.data and biz.data["id"] == booking["business_id"]:
            return True
    return False


@router.get("/mine")
def list_my_payments(current_user: dict = Depends(get_current_user)):
    """F1 (audit 2026-07-01) — list all payments the caller has visibility on.

    Client: payments for bookings they placed.
    Business owner: payments for bookings against their business.
    Returns: {items: [...], total_released, total_pending} for EarningsScreen.
    """
    role = current_user.get("role")
    uid = current_user["id"]

    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if not biz.data:
            return {"items": [], "total_released": 0, "total_pending": 0}
        biz_id = biz.data["id"]
        # payments joined via bookings for this business
        bookings = (
            supabase.table("bookings").select("id").eq("business_id", biz_id).execute()
        )
        booking_ids = [b["id"] for b in (bookings.data or [])]
        if not booking_ids:
            return {"items": [], "total_released": 0, "total_pending": 0}
        pay = (
            supabase.table("payments")
            .select(
                "*, bookings(scheduled_date:confirmed_date, service_category, client_id)"
            )
            .in_("booking_id", booking_ids)
            .order("created_at", desc=True)
            .execute()
        )
    else:
        # client — payments on their bookings
        bookings = (
            supabase.table("bookings").select("id").eq("client_id", uid).execute()
        )
        booking_ids = [b["id"] for b in (bookings.data or [])]
        if not booking_ids:
            return {"items": [], "total_released": 0, "total_pending": 0}
        pay = (
            supabase.table("payments")
            .select("*, bookings(scheduled_date:confirmed_date, service_category)")
            .in_("booking_id", booking_ids)
            .order("created_at", desc=True)
            .execute()
        )

    items = pay.data or []

    # All totals are summed in INTEGER CENTS and converted once at the end.
    # Summing float dollars accumulates binary drift across a business's whole
    # history; the *_cents columns (migration 20260723120000) are authoritative.
    total_released_c = sum(escrow.money_cents(p, "released_to_business") for p in items)
    # fix C: the old filter used bookings.payment_status literals which never
    # matched payments.status, so total_pending was always 0. "Pending" here =
    # money held in escrow, not yet released to the business. Sourced from
    # escrow.HELD_NOT_RELEASED so both status vocabularies live in one place.
    total_pending_c = sum(
        escrow.money_cents(p, "escrow_held")
        for p in items
        if p.get("status") in escrow.HELD_NOT_RELEASED
    )

    # FINDING C transparency. 24 of 29 production payment rows read
    # 'fully_released' with no Stripe charge behind them — $4,675.50 of payouts
    # nobody ever paid. Those rows are legacy data and are NOT rewritten here,
    # but the reader must stop presenting them as money that moved. `verified`
    # counts only capture-backed rows; the difference is surfaced explicitly so
    # a caller (or an Earnings screen) can show the honest figure instead of
    # silently adding phantom dollars into a headline number.
    verified_released_c = sum(
        escrow.money_cents(p, "released_to_business")
        for p in items
        if escrow.is_capture_backed(p)
    )
    unverified_released_c = total_released_c - verified_released_c

    return {
        "items": items,
        "total_released": escrow.to_dollars(total_released_c),
        "total_pending": escrow.to_dollars(total_pending_c),
        # Cents are the authoritative figures; the dollar keys above are kept
        # for the existing mobile/admin readers.
        "total_released_cents": total_released_c,
        "total_pending_cents": total_pending_c,
        "verified_released": escrow.to_dollars(verified_released_c),
        "verified_released_cents": verified_released_c,
        "unverified_released": escrow.to_dollars(unverified_released_c),
        "unverified_released_cents": unverified_released_c,
    }


@router.get("/{booking_id}")
def get_payment(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Returns the payment record for a given booking."""
    booking_res = (
        supabase.table("bookings")
        .select("client_id, business_id")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not _can_view_payment(booking_res.data, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        payment_res = (
            supabase.table("payments")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        return payment_res.data
    except Exception:
        raise HTTPException(status_code=404, detail="Payment record not found")
