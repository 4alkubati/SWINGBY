import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional
from app.deps import get_current_user
from app.supabase_client import supabase
from app.services import url_safety

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class EmployeeUpdate(BaseModel):
    role_title: Optional[str] = Field(None, max_length=120)


class EmployeeCreate(BaseModel):
    email: EmailStr = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    phone: Optional[str] = Field(None, max_length=20)
    role_title: Optional[str] = Field(None, max_length=120)
    avatar_url: Optional[str] = Field(None, max_length=2048)

    @field_validator("avatar_url", mode="before")
    @classmethod
    def validate_avatar_url(cls, v):
        """SB-0016 — this field had no validator of any kind.

        That made it strictly weaker than the PRE-fix state of
        `users.avatar_url`, which at least reached a scheme check: it accepted
        `javascript:alert(1)`, `file:///etc/passwd` and the cloud metadata IP,
        and POST /employees/ writes it straight through. Employee avatars are
        rendered on the business team card and in booking payloads, so the
        value reaches other users' clients.
        """
        return url_safety.as_stored_image_url(v)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v):
        v = str(v).strip()
        if not v:
            raise ValueError("Name fields cannot be blank")
        return v


# ── "Small business" ──────────────────────────────────────────────────────────
#
# PRODUCT JUDGEMENT — the founder may want to retune this number. It exists in
# exactly one place on purpose; do not inline the figure anywhere else.
#
# Context (founder ruling, 2026-07-25): the jobs lane gave every business owner a
# real `employees` row so a solo operator can assign a job to themselves. Correct
# internally — and it also put the owner on the PUBLIC team trust card for every
# business, which is only right for SMALL ones. A two-person outfit whose card
# hides the owner looks like it has one employee; a forty-person company whose
# card leads with "Owner" looks like a founder doing the mopping.
#
# "Small" = this many ACTIVE team members or fewer, counting the owner. At 3, a
# solo operator, a pair, and an owner-plus-two all still show the owner.
SMALL_BUSINESS_MAX_TEAM_SIZE = 3


# ── Helper ────────────────────────────────────────────────────────────────────


def _owner_user_id(business_id: str) -> Optional[str]:
    """The `users.id` of this business's owner, or None if it can't be read.

    None is a real answer, not an error: every caller treats "we don't know who
    the owner is" as "don't filter anything out", so a Supabase hiccup degrades
    the trust card to its previous behaviour instead of blanking a team.
    """
    try:
        res = (
            supabase.table("businesses")
            .select("owner_id")
            .eq("id", business_id)
            .single()
            .execute()
        )
        data = res.data
        # .single() should give a dict; be defensive about a list slipping
        # through, because guessing wrong here would hide a real employee.
        if isinstance(data, list):
            data = data[0] if data else None
        if isinstance(data, dict):
            return data.get("owner_id")
    except Exception:
        logger.warning(
            "owner lookup failed for business %s", business_id, exc_info=True
        )
    return None


def _owner_employee_id(business_id: str) -> Optional[str]:
    """The ``employees.id`` of the owner's own row, or None if unknown.

    Looked up separately rather than by selecting ``user_id`` on the roster
    query, because the 2026-07-21 hardening says ``user_id`` must not appear in
    the public payload — and the cheapest way to keep that true is never to
    fetch it alongside the rows we are about to return.
    """
    owner_id = _owner_user_id(business_id)
    if not owner_id:
        return None
    try:
        res = (
            supabase.table("employees")
            .select("id")
            .eq("business_id", business_id)
            .eq("user_id", owner_id)
            .limit(1)
            .execute()
        )
        rows = res.data
        if isinstance(rows, dict):
            rows = [rows]
        if rows and isinstance(rows[0], dict):
            return rows[0].get("id")
    except Exception:
        logger.warning(
            "owner employee lookup failed for business %s", business_id, exc_info=True
        )
    return None


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


@router.patch("/{employee_id}")
def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    current_user: dict = Depends(get_current_user),
):
    """F103 — EmployeeEditModal's Role Title field had no endpoint to save to;
    handleSave only merged it into local state, which the next GET /employees/
    (refocus, restart, pull-to-refresh) silently reverted. This is that
    endpoint. Deliberately narrow (role_title only) — deactivate/reactivate
    already own the is_active toggle and stay separate.
    """
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can update employees"
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

    updates = data.model_dump(exclude_unset=True)
    if "role_title" in updates and updates["role_title"] is not None:
        updates["role_title"] = updates["role_title"].strip() or None
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        res = (
            supabase.table("employees").update(updates).eq("id", employee_id).execute()
        )
        return {"message": "Employee updated", "employee": res.data[0]}
    except Exception:
        logger.exception("Could not update employee")
        raise HTTPException(status_code=400, detail="Could not update employee")


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
    """Public trust-card list. Any authenticated user can view a business's team.

    Owner ruling (2026-07-21): stays public, but only ACTIVE employees are
    shown and the internal ``user_id`` is never exposed in the payload — a trust
    card needs a name, photo and role, not the account id behind it.

    Founder ruling (2026-07-25): the owner has a real ``employees`` row now (see
    bookings._ensure_owner_employee) so a solo operator can be assigned work.
    That row belongs on this PUBLIC card only when the business is small — see
    SMALL_BUSINESS_MAX_TEAM_SIZE. The INTERNAL assignable roster (``GET
    /employees/`` and the assignee picker) is untouched: the owner is always
    assignable, at every size. This filter is presentation, never permission.
    """
    try:
        res = (
            supabase.table("employees")
            .select(
                "id, business_id, role_title, is_active, avatar_url, created_at, users(first_name, last_name, avatar_url)"
            )
            .eq("business_id", business_id)
            .eq("is_active", True)
            .order("created_at")
            .execute()
        )
        rows = res.data or []
    except Exception:
        logger.exception("Could not list employees for business")
        raise HTTPException(status_code=400, detail="Could not list employees")

    # `rows` is already the active-only team INCLUDING the owner's row, so its
    # length is exactly the "total active team members, counting the owner"
    # the threshold is defined in terms of. Small businesses short-circuit here
    # and cost no extra queries at all.
    if len(rows) <= SMALL_BUSINESS_MAX_TEAM_SIZE:
        return rows

    owner_employee_id = _owner_employee_id(business_id)
    if not owner_employee_id:
        # Owner unknown, or they have no employees row. Nothing identifiable to
        # drop — return the team rather than guessing and hiding a real person.
        return rows

    return [r for r in rows if r.get("id") != owner_employee_id]


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
        .select("business_name, license_status, owner_id")
        .eq("id", employee["business_id"])
        .single()
        .execute()
    )
    if not biz.data:
        raise HTTPException(status_code=404, detail="Parent business not found")
    business = biz.data
    is_owner = business.get("owner_id") == employee["user_id"]

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

    # D-W8 — the owner is the business, so count the business's work.
    #
    # This counted `bookings.employee_id = <this employee>` for everyone,
    # including the owner. An owner's `employees` row is materialised lazily by
    # `_ensure_owner_employee`, and bookings they handled before that (or
    # handled without assigning anyone) carry no employee_id at all — so the
    # owner's own trust card read "0 JOBS" while their Jobs tab showed Past (4).
    # Two different questions rendered under one label.
    #
    # For a real staff member the employee-scoped count is still the honest
    # number: it is THEIR record, not the company's, and inflating it with work
    # they did not do is the opposite of a trust signal. Only the owner reads
    # business-wide, because for them the two are the same thing — which is the
    # same reasoning D-W5 applied to tenure.
    try:
        query = (
            supabase.table("bookings")
            .select("id", count="exact")
            .eq("status", "completed")
        )
        if is_owner:
            query = query.eq("business_id", employee["business_id"])
        else:
            query = query.eq("employee_id", employee_id)
        jobs_res = query.execute()
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
