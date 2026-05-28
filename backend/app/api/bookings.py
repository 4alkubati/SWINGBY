import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.deps import get_current_user
from app.supabase_client import supabase
from app.services.push import send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class AssignEmployee(BaseModel):
    employee_id: str
    proposed_date_1: Optional[str] = None   # ISO-8601 strings
    proposed_date_2: Optional[str] = None
    proposed_date_3: Optional[str] = None


class ConfirmDate(BaseModel):
    confirmed_date: str   # client picks one of the proposed dates


class CancelBooking(BaseModel):
    reason: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _assert_booking_access(booking: dict, current_user: dict):
    """Raises 403 if the current user has no relationship to this booking."""
    role = current_user["role"]
    uid = current_user["id"]

    if booking["client_id"] == uid:
        return

    if role == "business_owner":
        biz = supabase.table("businesses").select("id").eq("owner_id", uid).single().execute()
        if biz.data and biz.data["id"] == booking["business_id"]:
            return

    if role == "employee":
        emp = supabase.table("employees").select("id").eq("user_id", uid).single().execute()
        if emp.data and emp.data["id"] == booking.get("employee_id"):
            return

    raise HTTPException(status_code=403, detail="Access denied")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
def list_my_bookings(current_user: dict = Depends(get_current_user)):
    """Returns bookings relevant to the current user (client / owner / employee)."""
    role = current_user["role"]
    uid = current_user["id"]

    try:
        if role == "client":
            res = (
                supabase.table("bookings")
                .select("*, businesses(business_name, category), employees(role_title, avatar_url, users(first_name, last_name))")
                .eq("client_id", uid)
                .order("created_at", desc=True)
                .execute()
            )
        elif role == "business_owner":
            biz = supabase.table("businesses").select("id").eq("owner_id", uid).single().execute()
            if not biz.data:
                return []
            res = (
                supabase.table("bookings")
                .select("*, users(first_name, last_name), employees(role_title)")
                .eq("business_id", biz.data["id"])
                .order("created_at", desc=True)
                .execute()
            )
        elif role == "employee":
            emp = supabase.table("employees").select("id").eq("user_id", uid).single().execute()
            if not emp.data:
                return []
            res = (
                supabase.table("bookings")
                .select("*, users(first_name, last_name), businesses(business_name)")
                .eq("employee_id", emp.data["id"])
                .order("created_at", desc=True)
                .execute()
            )
        else:
            return []

        return res.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{booking_id}")
def get_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("bookings")
            .select("*, businesses(business_name, category), employees(role_title, avatar_url, users(first_name, last_name))")
            .eq("id", booking_id)
            .single()
            .execute()
        )
        _assert_booking_access(res.data, current_user)
        return res.data
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Booking not found")


@router.patch("/{booking_id}/assign-employee")
def assign_employee(
    booking_id: str,
    data: AssignEmployee,
    current_user: dict = Depends(get_current_user),
):
    """Business owner assigns one of their employees and proposes up to 3 dates."""
    if current_user["role"] != "business_owner":
        raise HTTPException(status_code=403, detail="Only business owners can assign employees")

    booking_res = supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    biz = supabase.table("businesses").select("id").eq("owner_id", current_user["id"]).single().execute()
    if not biz.data or biz.data["id"] != booking["business_id"]:
        raise HTTPException(status_code=403, detail="This booking doesn't belong to your business")

    # Validate employee is active and belongs to this business
    emp = (
        supabase.table("employees")
        .select("id, is_active")
        .eq("id", data.employee_id)
        .eq("business_id", biz.data["id"])
        .single()
        .execute()
    )
    if not emp.data:
        raise HTTPException(status_code=404, detail="Employee not found in your business")
    if not emp.data["is_active"]:
        raise HTTPException(status_code=400, detail="Employee is deactivated")

    update_payload = {"employee_id": data.employee_id}
    if data.proposed_date_1:
        update_payload["proposed_date_1"] = data.proposed_date_1
    if data.proposed_date_2:
        update_payload["proposed_date_2"] = data.proposed_date_2
    if data.proposed_date_3:
        update_payload["proposed_date_3"] = data.proposed_date_3

    try:
        res = supabase.table("bookings").update(update_payload).eq("id", booking_id).execute()
        return {"message": "Employee assigned", "booking": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{booking_id}/confirm-date")
def confirm_date(
    booking_id: str,
    data: ConfirmDate,
    current_user: dict = Depends(get_current_user),
):
    """Client confirms one of the proposed dates — moves booking to in_progress."""
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can confirm dates")

    booking_res = supabase.table("bookings").select("client_id, status").eq("id", booking_id).single().execute()
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking_res.data["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="This is not your booking")
    if booking_res.data["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Booking is not in 'confirmed' state")

    try:
        res = supabase.table("bookings").update({
            "confirmed_date": data.confirmed_date,
            "status": "in_progress",
        }).eq("id", booking_id).execute()
        updated_booking = res.data[0]

        # Notify both client and business owner — best-effort
        try:
            full_booking = (
                supabase.table("bookings")
                .select("client_id, business_id")
                .eq("id", booking_id)
                .single()
                .execute()
            )
            if full_booking.data:
                client_uid = full_booking.data["client_id"]
                biz_id = full_booking.data["business_id"]

                # Notify client
                if client_uid:
                    send_push_to_user(client_uid, "Booking confirmed", "Your booking date is confirmed")

                # Look up business owner user_id
                biz_owner_res = (
                    supabase.table("businesses")
                    .select("owner_id")
                    .eq("id", biz_id)
                    .single()
                    .execute()
                )
                biz_owner_id = (
                    biz_owner_res.data["owner_id"] if biz_owner_res.data else None
                )
                if biz_owner_id:
                    send_push_to_user(biz_owner_id, "Booking confirmed", "A booking date has been confirmed")
        except Exception:
            pass  # push failure must not break the request

        return {"message": "Date confirmed — booking is now in progress", "booking": updated_booking}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{booking_id}/complete")
def complete_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    """
    Business owner or assigned employee marks job complete.

    Payment logic:
      - Booking: status → completed, payment_status → fully_released
      - Payment: release remaining 50 % escrow minus 10 % platform cut.
        e.g. $100 total: $50 already released, now release $40, SwingBy keeps $10.
    """
    if current_user["role"] not in ("business_owner", "employee"):
        raise HTTPException(status_code=403, detail="Only business owners or employees can complete bookings")

    booking_res = supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    if booking["status"] == "completed":
        raise HTTPException(status_code=400, detail="Booking is already completed")

    # Authorisation
    if current_user["role"] == "business_owner":
        biz = supabase.table("businesses").select("id").eq("owner_id", current_user["id"]).single().execute()
        if not biz.data or biz.data["id"] != booking["business_id"]:
            raise HTTPException(status_code=403, detail="This booking doesn't belong to your business")
    else:  # employee
        emp = supabase.table("employees").select("id").eq("user_id", current_user["id"]).single().execute()
        if not emp.data or emp.data["id"] != booking.get("employee_id"):
            raise HTTPException(status_code=403, detail="You are not assigned to this booking")

    try:
        # Update booking
        supabase.table("bookings").update({
            "status": "completed",
            "payment_status": "fully_released",
        }).eq("id", booking_id).execute()

        # Release remaining escrow (minus platform cut)
        payment_res = supabase.table("payments").select("*").eq("booking_id", booking_id).single().execute()
        if payment_res.data:
            p = payment_res.data
            # already_released = 50 %, platform_cut = 10 % → final release = 40 %
            final_release = round(p["total_charged"] - p["platform_cut"] - p["released_to_business"], 2)
            supabase.table("payments").update({
                "released_to_business": round(p["released_to_business"] + final_release, 2),
                "escrow_held": 0,
                "status": "completed",
                "released_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", p["id"]).execute()

        return {"message": "Booking completed — full payment released (minus platform fee)"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{booking_id}/cancel")
def cancel_booking(
    booking_id: str,
    data: CancelBooking,
    current_user: dict = Depends(get_current_user),
):
    """
    Cancel a booking. Penalty logic (proximity to confirmed_date):
      - No confirmed date set   → no penalty
      - > 48 h before date      → 25 % penalty  (business keeps 25 % of total)
      - ≤ 48 h before date      → 50 % penalty  (business keeps 50 % of total)
    """
    booking_res = supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    _assert_booking_access(booking, current_user)

    if booking["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel a booking with status '{booking['status']}'")

    # Calculate penalty
    penalty_amount = 0.0
    confirmed_date = booking.get("confirmed_date")
    total = booking.get("total_amount", 0)

    if confirmed_date:
        now = datetime.now(timezone.utc)
        try:
            job_dt = datetime.fromisoformat(confirmed_date.replace("Z", "+00:00"))
            hours_until = (job_dt - now).total_seconds() / 3600
            if hours_until <= 48:
                penalty_amount = round(total * 0.50, 2)
            else:
                penalty_amount = round(total * 0.25, 2)
        except (ValueError, TypeError):
            pass  # malformed date — no penalty

    try:
        # Update booking
        supabase.table("bookings").update({
            "status": "cancelled",
            "payment_status": "refunded",
        }).eq("id", booking_id).execute()

        # Log cancellation
        supabase.table("cancellations").insert({
            "booking_id": booking_id,
            "cancelled_by": current_user["id"],
            "reason": data.reason,
            "penalty_amount": penalty_amount,
        }).execute()

        # Update payment record
        payment_res = supabase.table("payments").select("id").eq("booking_id", booking_id).single().execute()
        if payment_res.data:
            supabase.table("payments").update({"status": "refunded"}).eq("id", payment_res.data["id"]).execute()

        return {
            "message": "Booking cancelled",
            "penalty_amount": penalty_amount,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
