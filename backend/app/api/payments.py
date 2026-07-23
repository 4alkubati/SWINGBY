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
    total_released = sum(float(p.get("released_to_business") or 0) for p in items)
    # fix C: the old filter used bookings.payment_status literals which never
    # matched payments.status, so total_pending was always 0. "Pending" here =
    # money held in escrow, not yet released to the business. Sourced from
    # escrow.HELD_NOT_RELEASED so the two vocabularies (pre/post migration
    # 0001) stay defined in exactly one place.
    total_pending = sum(
        float(p.get("escrow_held") or 0)
        for p in items
        if p.get("status") in escrow.HELD_NOT_RELEASED
    )
    return {
        "items": items,
        "total_released": round(total_released, 2),
        "total_pending": round(total_pending, 2),
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
