from fastapi import APIRouter, HTTPException, Depends
from app.deps import get_current_user
from app.supabase_client import supabase

router = APIRouter()


def _can_view_payment(booking: dict, current_user: dict) -> bool:
    """Returns True if the current user is the client or the business owner."""
    if booking["client_id"] == current_user["id"]:
        return True
    if current_user["role"] == "business_owner":
        biz = supabase.table("businesses").select("id").eq("owner_id", current_user["id"]).single().execute()
        if biz.data and biz.data["id"] == booking["business_id"]:
            return True
    return False


@router.get("/{booking_id}")
def get_payment(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Returns the payment record for a given booking."""
    booking_res = supabase.table("bookings").select("client_id, business_id").eq("id", booking_id).single().execute()
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not _can_view_payment(booking_res.data, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        payment_res = supabase.table("payments").select("*").eq("booking_id", booking_id).single().execute()
        return payment_res.data
    except Exception:
        raise HTTPException(status_code=404, detail="Payment record not found")
