import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class ReviewCreate(BaseModel):
    booking_id: str = Field(..., min_length=1)
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)

    @field_validator("comment", mode="before")
    @classmethod
    def strip_comment(cls, v):
        if v is not None:
            return str(v).strip() or None
        return v


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/")
def create_review(data: ReviewCreate, current_user: dict = Depends(get_current_user)):
    booking_res = (
        supabase.table("bookings")
        .select("*")
        .eq("id", data.booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    if booking["status"] != "completed":
        raise HTTPException(
            status_code=400, detail="Can only review completed bookings"
        )

    role = current_user["role"]
    reviewee_id = None
    reviewee_type = None
    # Live Job Status assigns a specific worker to a booking (bookings.employee_id
    # -> employees.id). When a client reviews that booking, the same rating +
    # comment also becomes that employee's own trust-card review (reviewee_type
    # 'employee', reviewee_id = the employee's users.id) — a second polymorphic
    # row alongside the existing business-targeted one. See
    # docs/reviews_reviewee_type_extend_employee.sql (CARD MOBILE-PRODUCT Goal 2).
    employee_user_id = None

    if role == "client":
        if booking["client_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="This is not your booking")
        reviewee_id = booking["business_id"]
        reviewee_type = "business"

        if booking.get("employee_id"):
            emp_row = (
                supabase.table("employees")
                .select("user_id")
                .eq("id", booking["employee_id"])
                .single()
                .execute()
            )
            if emp_row.data:
                employee_user_id = emp_row.data["user_id"]
    elif role == "business_owner":
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
        reviewee_id = booking["client_id"]
        reviewee_type = "client"
    else:
        raise HTTPException(status_code=403, detail="Employees cannot leave reviews")

    dup = (
        supabase.table("reviews")
        .select("id")
        .eq("booking_id", data.booking_id)
        .eq("reviewer_id", current_user["id"])
        .execute()
    )
    if dup.data:
        raise HTTPException(status_code=400, detail="You already reviewed this booking")

    try:
        res = (
            supabase.table("reviews")
            .insert(
                {
                    "booking_id": data.booking_id,
                    "reviewer_id": current_user["id"],
                    "reviewee_id": reviewee_id,
                    "reviewee_type": reviewee_type,
                    "rating": data.rating,
                    "comment": data.comment,
                }
            )
            .execute()
        )

        # Keep avg_rating + review_count on businesses table in sync
        if reviewee_type == "business":
            all_reviews = (
                supabase.table("reviews")
                .select("rating")
                .eq("reviewee_id", reviewee_id)
                .eq("reviewee_type", "business")
                .execute()
            )
            if all_reviews.data:
                avg = sum(r["rating"] for r in all_reviews.data) / len(all_reviews.data)
                supabase.table("businesses").update(
                    {
                        "avg_rating": round(avg, 2),
                        "review_count": len(all_reviews.data),
                    }
                ).eq("id", reviewee_id).execute()

        # Secondary employee-targeted row (see note above). Best-effort: the
        # reviewee_type CHECK extension may not be applied yet on this
        # environment, in which case this insert raises and is swallowed here
        # — the primary business review above has already succeeded and must
        # not be rolled back or surfaced as an error to the caller.
        if employee_user_id:
            try:
                supabase.table("reviews").insert(
                    {
                        "booking_id": data.booking_id,
                        "reviewer_id": current_user["id"],
                        "reviewee_id": employee_user_id,
                        "reviewee_type": "employee",
                        "rating": data.rating,
                        "comment": data.comment,
                    }
                ).execute()
            except Exception:
                logger.warning(
                    "Could not write employee-targeted review row for booking %s "
                    "— reviewee_type CHECK likely not yet extended, see "
                    "docs/reviews_reviewee_type_extend_employee.sql",
                    data.booking_id,
                )

        return {"message": "Review submitted", "review": res.data[0]}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not submit review")
        raise HTTPException(status_code=400, detail="Could not submit review")


@router.get("/business/{business_id}")
def get_business_reviews(
    business_id: str, current_user: dict = Depends(get_current_user)
):
    try:
        res = (
            supabase.table("reviews")
            .select("*, users(first_name, last_name)")
            .eq("reviewee_id", business_id)
            .eq("reviewee_type", "business")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data
    except Exception:
        logger.exception("Could not retrieve business reviews")
        raise HTTPException(status_code=400, detail="Could not retrieve reviews")


@router.get("/client/{client_id}")
def get_client_reviews(client_id: str, current_user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("reviews")
            .select("*, businesses(business_name)")
            .eq("reviewee_id", client_id)
            .eq("reviewee_type", "client")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data
    except Exception:
        logger.exception("Could not retrieve client reviews")
        raise HTTPException(status_code=400, detail="Could not retrieve reviews")


@router.get("/employee/{employee_user_id}")
def get_employee_reviews(
    employee_user_id: str, current_user: dict = Depends(get_current_user)
):
    """
    MOBILE-PRODUCT Goal 2 — backs EmployeeProfileScreen's review list.

    `employee_user_id` is the employee's users.id (not the employees.id row
    id) — same key GET /employees/{id}/profile already aggregates
    avg_rating/review_count against. Returns [] today until
    docs/reviews_reviewee_type_extend_employee.sql is applied, since no
    reviewee_type='employee' rows can exist before that CHECK extension —
    not a bug, just genuinely empty.
    """
    try:
        res = (
            supabase.table("reviews")
            .select("*, users(first_name, last_name)")
            .eq("reviewee_id", employee_user_id)
            .eq("reviewee_type", "employee")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data
    except Exception:
        logger.exception("Could not retrieve employee reviews")
        raise HTTPException(status_code=400, detail="Could not retrieve reviews")
