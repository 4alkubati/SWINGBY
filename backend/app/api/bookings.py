import logging

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from app.deps import get_current_user
from app.supabase_client import supabase
from app.services.push import send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class AssignEmployee(BaseModel):
    employee_id: str = Field(..., min_length=1, max_length=500)
    proposed_date_1: Optional[str] = Field(None, max_length=500)  # ISO-8601 strings
    proposed_date_2: Optional[str] = Field(None, max_length=500)
    proposed_date_3: Optional[str] = Field(None, max_length=500)


class ConfirmDate(BaseModel):
    confirmed_date: str = Field(
        ..., max_length=500
    )  # client picks one of the proposed dates


class CancelBooking(BaseModel):
    reason: Optional[str] = Field(None, max_length=2000)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _assert_booking_access(booking: dict, current_user: dict):
    """Raises 403 if the current user has no relationship to this booking."""
    role = current_user["role"]
    uid = current_user["id"]

    if booking["client_id"] == uid:
        return

    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if biz.data and biz.data["id"] == booking["business_id"]:
            return

    if role == "employee":
        emp = (
            supabase.table("employees")
            .select("id")
            .eq("user_id", uid)
            .single()
            .execute()
        )
        if emp.data and emp.data["id"] == booking.get("employee_id"):
            return

    raise HTTPException(status_code=403, detail="Access denied")


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/")
def list_my_bookings(
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user),
):
    """Returns bookings relevant to the current user (client / owner / employee)."""
    role = current_user["role"]
    uid = current_user["id"]

    try:
        if role == "client":
            res = (
                supabase.table("bookings")
                .select(
                    "*, businesses(business_name, category, avg_rating), "
                    "employees(role_title, avatar_url, users(first_name, last_name)), "
                    "service_posts(title, address)"
                )
                .eq("client_id", uid)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        elif role == "business_owner":
            biz = (
                supabase.table("businesses")
                .select("id")
                .eq("owner_id", uid)
                .single()
                .execute()
            )
            if not biz.data:
                return {
                    "items": [],
                    "limit": limit,
                    "offset": offset,
                    "next_offset": None,
                }
            res = (
                supabase.table("bookings")
                .select(
                    "*, users(first_name, last_name, avatar_url), "
                    "employees(role_title, users(first_name, last_name)), "
                    "service_posts(title, address)"
                )
                .eq("business_id", biz.data["id"])
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        elif role == "employee":
            emp = (
                supabase.table("employees")
                .select("id")
                .eq("user_id", uid)
                .single()
                .execute()
            )
            if not emp.data:
                return {
                    "items": [],
                    "limit": limit,
                    "offset": offset,
                    "next_offset": None,
                }
            res = (
                supabase.table("bookings")
                .select(
                    "*, users(first_name, last_name), businesses(business_name), "
                    "service_posts(title, address)"
                )
                .eq("employee_id", emp.data["id"])
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        else:
            return {"items": [], "limit": limit, "offset": offset, "next_offset": None}

        items = res.data or []
        next_offset = offset + limit if len(items) == limit else None
        return {
            "items": items,
            "limit": limit,
            "offset": offset,
            "next_offset": next_offset,
        }
    except Exception:
        logger.exception("Could not list bookings")
        raise HTTPException(status_code=400, detail="Could not list bookings")


@router.get("/{booking_id}")
def get_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("bookings")
            .select(
                "*, users(first_name, last_name, avatar_url), "
                "businesses(business_name, category, avg_rating, review_count), "
                "employees(role_title, avatar_url, users(first_name, last_name)), "
                "service_posts(title, address)"
            )
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
        raise HTTPException(
            status_code=403, detail="Only business owners can assign employees"
        )

    booking_res = (
        supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    biz = (
        supabase.table("businesses")
        .select("id")
        .eq("owner_id", current_user["id"])
        .single()
        .execute()
    )
    if not biz.data or biz.data["id"] != booking["business_id"]:
        raise HTTPException(
            status_code=403, detail="This booking doesn't belong to your business"
        )

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
        raise HTTPException(
            status_code=404, detail="Employee not found in your business"
        )
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
        res = (
            supabase.table("bookings")
            .update(update_payload)
            .eq("id", booking_id)
            .execute()
        )
        return {"message": "Employee assigned", "booking": res.data[0]}
    except Exception:
        logger.exception("Could not assign employee to booking")
        raise HTTPException(status_code=400, detail="Could not assign employee")


@router.patch("/{booking_id}/confirm-date")
def confirm_date(
    booking_id: str,
    data: ConfirmDate,
    current_user: dict = Depends(get_current_user),
):
    """Client confirms one of the proposed dates — moves booking to in_progress."""
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can confirm dates")

    booking_res = (
        supabase.table("bookings")
        .select("client_id, status")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking_res.data["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="This is not your booking")
    if booking_res.data["status"] != "confirmed":
        raise HTTPException(
            status_code=400, detail="Booking is not in 'confirmed' state"
        )

    try:
        res = (
            supabase.table("bookings")
            .update(
                {
                    "confirmed_date": data.confirmed_date,
                    "status": "in_progress",
                }
            )
            .eq("id", booking_id)
            .execute()
        )
        updated_booking = res.data[0]

        # Record the handshake on the live timeline — best-effort, must not
        # break the request if it fails (mirrors the notification try/except
        # below).
        try:
            supabase.table("booking_events").insert(
                {
                    "booking_id": booking_id,
                    "actor_id": current_user["id"],
                    "event_type": "date_confirmed",
                    "note": f"Confirmed date: {data.confirmed_date}",
                }
            ).execute()
        except Exception:
            logger.warning(
                "Could not record date_confirmed booking_event for %s",
                booking_id,
                exc_info=True,
            )

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
                    send_push_to_user(
                        client_uid,
                        "Booking confirmed",
                        "Your booking date is confirmed",
                    )

                # Look up business owner + email date-confirmed notification
                biz_owner_res = (
                    supabase.table("businesses")
                    .select("owner_id, business_name")
                    .eq("id", biz_id)
                    .single()
                    .execute()
                )
                biz_owner_id = (
                    biz_owner_res.data["owner_id"] if biz_owner_res.data else None
                )
                biz_name = (
                    biz_owner_res.data["business_name"]
                    if biz_owner_res.data
                    else "Your business"
                )
                if biz_owner_id:
                    send_push_to_user(
                        biz_owner_id,
                        "Booking confirmed",
                        "A booking date has been confirmed",
                    )
                    try:
                        from app.services.email import send_date_confirmed_business

                        biz_owner_user_res = (
                            supabase.table("users")
                            .select("email")
                            .eq("id", biz_owner_id)
                            .single()
                            .execute()
                        )
                        if biz_owner_user_res.data:
                            send_date_confirmed_business(
                                biz_owner_user_res.data["email"],
                                biz_name,
                                booking_id,
                                data.confirmed_date,
                            )
                    except Exception:
                        pass
        except Exception:
            pass  # notification failure must not break the request

        return {
            "message": "Date confirmed — booking is now in progress",
            "booking": updated_booking,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not confirm booking date")
        raise HTTPException(status_code=400, detail="Could not confirm booking date")


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
        raise HTTPException(
            status_code=403,
            detail="Only business owners or employees can complete bookings",
        )

    booking_res = (
        supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    if booking["status"] == "completed":
        raise HTTPException(status_code=400, detail="Booking is already completed")

    # Authorisation
    if current_user["role"] == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
        if not biz.data or biz.data["id"] != booking["business_id"]:
            raise HTTPException(
                status_code=403, detail="This booking doesn't belong to your business"
            )
    else:  # employee
        emp = (
            supabase.table("employees")
            .select("id")
            .eq("user_id", current_user["id"])
            .single()
            .execute()
        )
        if not emp.data or emp.data["id"] != booking.get("employee_id"):
            raise HTTPException(
                status_code=403, detail="You are not assigned to this booking"
            )

    try:
        # Release remaining escrow FIRST (minus platform cut). If this fails the
        # booking stays in its current status and the call is safely retryable —
        # flipping the booking first left completed bookings with stuck escrow.
        payment_res = (
            supabase.table("payments")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        if payment_res.data:
            p = payment_res.data
            # already_released = 50 %, platform_cut = 10 % → final release = 40 %
            final_release = round(
                p["total_charged"] - p["platform_cut"] - p["released_to_business"], 2
            )
            supabase.table("payments").update(
                {
                    "released_to_business": round(
                        p["released_to_business"] + final_release, 2
                    ),
                    "escrow_held": 0,
                    # payments_status_check allows: pending | partial | paid_full |
                    # paid_off_platform | fully_released | refunded | failed
                    "status": "fully_released",
                    "released_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", p["id"]).execute()

        # Update booking
        supabase.table("bookings").update(
            {
                "status": "completed",
                "payment_status": "fully_released",
            }
        ).eq("id", booking_id).execute()

        # Email the client a completion notice + review nudge — best-effort
        try:
            from app.services.email import send_booking_completed_client

            client_user_res = (
                supabase.table("users")
                .select("email, first_name")
                .eq("id", booking["client_id"])
                .single()
                .execute()
            )
            biz_name_res = (
                supabase.table("businesses")
                .select("business_name")
                .eq("id", booking["business_id"])
                .single()
                .execute()
            )
            biz_name = (
                biz_name_res.data["business_name"]
                if biz_name_res.data
                else "the business"
            )
            if client_user_res.data:
                send_booking_completed_client(
                    client_user_res.data["email"],
                    client_user_res.data["first_name"],
                    booking_id,
                    biz_name,
                )
        except Exception:
            pass

        return {
            "message": "Booking completed — full payment released (minus platform fee)"
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not complete booking")
        raise HTTPException(status_code=400, detail="Could not complete booking")


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
    booking_res = (
        supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    _assert_booking_access(booking, current_user)

    if booking["status"] in ("completed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a booking with status '{booking['status']}'",
        )

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
        supabase.table("bookings").update(
            {
                "status": "cancelled",
                "payment_status": "refunded",
            }
        ).eq("id", booking_id).execute()

        # Log cancellation
        supabase.table("cancellations").insert(
            {
                "booking_id": booking_id,
                "cancelled_by": current_user["id"],
                "reason": data.reason,
                "penalty_amount": penalty_amount,
            }
        ).execute()

        # Update payment record
        payment_res = (
            supabase.table("payments")
            .select("id")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        if payment_res.data:
            supabase.table("payments").update({"status": "refunded"}).eq(
                "id", payment_res.data["id"]
            ).execute()

        # Email the OTHER party (whoever didn't cancel) — best-effort
        try:
            from app.services.email import send_booking_cancelled

            canceller_id = current_user["id"]
            client_id = booking["client_id"]
            biz_id = booking["business_id"]

            # Find the business owner's user_id
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

            # Determine which user to email (the one who did NOT cancel)
            other_user_id = None
            if canceller_id == client_id and biz_owner_id:
                other_user_id = biz_owner_id
            elif canceller_id != client_id:
                other_user_id = client_id

            if other_user_id:
                other_user_res = (
                    supabase.table("users")
                    .select("email, first_name")
                    .eq("id", other_user_id)
                    .single()
                    .execute()
                )
                if other_user_res.data:
                    send_booking_cancelled(
                        other_user_res.data["email"],
                        other_user_res.data["first_name"],
                        booking_id,
                        penalty_amount,
                    )
        except Exception:
            pass

        return {
            "message": "Booking cancelled",
            "penalty_amount": penalty_amount,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not cancel booking")
        raise HTTPException(status_code=400, detail="Could not cancel booking")
