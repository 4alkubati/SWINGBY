import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class EmployeeCreate(BaseModel):
    email: EmailStr = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    phone: Optional[str] = Field(None, max_length=20)
    role_title: Optional[str] = Field(None, max_length=120)
    avatar_url: Optional[str] = Field(None, max_length=2048)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v):
        v = str(v).strip()
        if not v:
            raise ValueError("Name fields cannot be blank")
        return v


# ── Helper ────────────────────────────────────────────────────────────────────


def _get_owner_business(owner_id: str) -> dict:
    res = (
        supabase.table("businesses")
        .select("id")
        .eq("owner_id", owner_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=404, detail="You don't have a business registered yet"
        )
    return res.data


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/")
def create_employee(
    data: EmployeeCreate, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can create employees"
        )

    biz = _get_owner_business(current_user["id"])

    try:
        # Create Supabase Auth user for the employee (requires service_role key)
        auth_res = supabase.auth.admin.create_user(
            {
                "email": str(data.email),
                "password": data.password,
                "email_confirm": True,
            }
        )
        emp_user_id = auth_res.user.id

        # A DB trigger on auth.users auto-inserts a bare public.users row
        # (role='client', empty names) the moment create_user() runs above —
        # so an INSERT here collides with a 409. upsert (matches PK by
        # default) overwrites that trigger row with the real employee
        # profile and succeeds whether or not the trigger already fired.
        # Same pattern already used in app/api/auth.py signup for the same
        # trigger.
        supabase.table("users").upsert(
            {
                "id": emp_user_id,
                "first_name": data.first_name,
                "last_name": data.last_name,
                "email": str(data.email),
                "phone": data.phone,
                "role": "employee",
            }
        ).execute()

        emp_res = (
            supabase.table("employees")
            .insert(
                {
                    "business_id": biz["id"],
                    "user_id": emp_user_id,
                    "role_title": data.role_title,
                    "avatar_url": data.avatar_url,
                    "is_active": True,
                }
            )
            .execute()
        )

        return {"message": "Employee created", "employee": emp_res.data[0]}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not create employee")
        raise HTTPException(status_code=400, detail="Could not create employee")


@router.get("/")
def list_employees(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can list employees"
        )

    biz = _get_owner_business(current_user["id"])

    try:
        res = (
            supabase.table("employees")
            .select("*, users(first_name, last_name, email, phone)")
            .eq("business_id", biz["id"])
            .order("created_at")
            .execute()
        )
        return res.data
    except Exception:
        logger.exception("Could not list employees")
        raise HTTPException(status_code=400, detail="Could not list employees")


@router.patch("/{employee_id}/deactivate")
def deactivate_employee(
    employee_id: str, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can deactivate employees"
        )

    biz = _get_owner_business(current_user["id"])
    emp = (
        supabase.table("employees")
        .select("id")
        .eq("id", employee_id)
        .eq("business_id", biz["id"])
        .single()
        .execute()
    )
    if not emp.data:
        raise HTTPException(
            status_code=404, detail="Employee not found in your business"
        )

    try:
        res = (
            supabase.table("employees")
            .update({"is_active": False})
            .eq("id", employee_id)
            .execute()
        )
        return {"message": "Employee deactivated", "employee": res.data[0]}
    except Exception:
        logger.exception("Could not deactivate employee")
        raise HTTPException(status_code=400, detail="Could not deactivate employee")


@router.patch("/{employee_id}/reactivate")
def reactivate_employee(
    employee_id: str, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can reactivate employees"
        )

    biz = _get_owner_business(current_user["id"])
    emp = (
        supabase.table("employees")
        .select("id")
        .eq("id", employee_id)
        .eq("business_id", biz["id"])
        .single()
        .execute()
    )
    if not emp.data:
        raise HTTPException(
            status_code=404, detail="Employee not found in your business"
        )

    try:
        res = (
            supabase.table("employees")
            .update({"is_active": True})
            .eq("id", employee_id)
            .execute()
        )
        return {"message": "Employee reactivated", "employee": res.data[0]}
    except Exception:
        logger.exception("Could not reactivate employee")
        raise HTTPException(status_code=400, detail="Could not reactivate employee")


@router.get("/business/{business_id}")
def list_employees_for_business(
    business_id: str, current_user: dict = Depends(get_current_user)
):
    """Public trust-card list. Any authenticated user can view a business's team."""
    try:
        res = (
            supabase.table("employees")
            .select(
                "id, business_id, user_id, role_title, is_active, avatar_url, created_at, users(first_name, last_name, avatar_url)"
            )
            .eq("business_id", business_id)
            .order("created_at")
            .execute()
        )
        return res.data or []
    except Exception:
        logger.exception("Could not list employees for business")
        raise HTTPException(status_code=400, detail="Could not list employees")


@router.get("/{employee_id}/profile")
def employee_profile(employee_id: str, current_user: dict = Depends(get_current_user)):
    """
    D2.1 — public trust card. Any authenticated user can read.

    Aggregates: identity + tenure + jobs_completed + verified flag (via parent
    business) + avg_rating/count from reviews where reviewee_type='employee'.

    NOTE: reviews.reviewee_type CHECK currently allows only ('client','business'),
    so avg_rating/review_count return null/0 today. When the client->employee
    review flow lands, extend the CHECK and this query starts returning data.
    """
    emp = (
        supabase.table("employees")
        .select("id, business_id, user_id, role_title, is_active, created_at")
        .eq("id", employee_id)
        .single()
        .execute()
    )
    if not emp.data:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee = emp.data

    biz = (
        supabase.table("businesses")
        .select("business_name, license_status")
        .eq("id", employee["business_id"])
        .single()
        .execute()
    )
    if not biz.data:
        raise HTTPException(status_code=404, detail="Parent business not found")
    business = biz.data

    user = (
        supabase.table("users")
        .select("first_name, last_name, avatar_url")
        .eq("id", employee["user_id"])
        .single()
        .execute()
    )
    user_row = user.data or {}

    try:
        reviews_res = (
            supabase.table("reviews")
            .select("rating")
            .eq("reviewee_id", employee["user_id"])
            .eq("reviewee_type", "employee")
            .execute()
        )
        ratings = [r["rating"] for r in (reviews_res.data or [])]
        avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None
        review_count = len(ratings)
    except Exception:
        logger.exception("Could not load employee reviews")
        avg_rating, review_count = None, 0

    try:
        jobs_res = (
            supabase.table("bookings")
            .select("id", count="exact")
            .eq("employee_id", employee_id)
            .eq("status", "completed")
            .execute()
        )
        jobs_completed = jobs_res.count or 0
    except Exception:
        logger.exception("Could not count completed jobs for employee")
        jobs_completed = 0

    return {
        "id": employee["id"],
        "user_id": employee["user_id"],
        "business_id": employee["business_id"],
        "role_title": employee.get("role_title"),
        "is_active": employee.get("is_active", False),
        "joined_at": employee.get("created_at"),
        "first_name": user_row.get("first_name"),
        "last_name": user_row.get("last_name"),
        "avatar_url": user_row.get("avatar_url"),
        "avg_rating": avg_rating,
        "review_count": review_count,
        "jobs_completed": jobs_completed,
        "verified_via_business": business.get("license_status") == "verified",
        "business_name": business.get("business_name"),
    }
