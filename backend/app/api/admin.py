"""
admin.py — Admin-only endpoints for the SwingBy backend.

T27  Admin user/booking management:
     - GET  /admin/users
     - GET  /admin/bookings
     - POST /admin/suspend-user/{user_id}
     - POST /admin/unsuspend-user/{user_id}
     - POST /admin/force-complete-booking/{booking_id}

Rate limit: 30/minute per IP for all admin endpoints.

NOTE: `users.is_suspended boolean default false` column must exist in the DB.
      Wave 6 migration should add it if not already present.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request

from app.deps import get_current_user
from app.limiter import limiter
from app.supabase_client import supabase

logger = structlog.get_logger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Dependency — admin guard
# ---------------------------------------------------------------------------


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Raises 403 if the authenticated user does not have role='admin'."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/users")
@limiter.limit("30/minute")
def list_users(
    request: Request,
    current_user: dict = Depends(require_admin),
):
    """Returns all users (admin only). Used by the admin app UsersPage."""
    try:
        res = (
            supabase.table("users")
            .select("id, email, first_name, last_name, role, is_suspended, created_at")
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        logger.exception("admin.list_users failed")
        raise HTTPException(status_code=400, detail="Could not list users")


@router.get("/bookings")
@limiter.limit("30/minute")
def list_bookings(
    request: Request,
    current_user: dict = Depends(require_admin),
):
    """Returns all bookings (admin only). Used by the admin app BookingsPage."""
    try:
        res = (
            supabase.table("bookings")
            .select("*")
            .order("created_at", desc=True)
            .limit(500)
            .execute()
        )
        return res.data or []
    except Exception:
        logger.exception("admin.list_bookings failed")
        raise HTTPException(status_code=400, detail="Could not list bookings")


@router.post("/suspend-user/{user_id}")
@limiter.limit("30/minute")
def suspend_user(
    request: Request,
    user_id: str,
    current_user: dict = Depends(require_admin),
):
    """Sets users.is_suspended = true for the given user."""
    try:
        res = (
            supabase.table("users")
            .update({"is_suspended": True})
            .eq("id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
        logger.info(
            "admin.suspend_user", admin_id=current_user["id"], target_user=user_id
        )
        return {"message": "user_suspended", "user_id": user_id}
    except HTTPException:
        raise
    except Exception:
        logger.exception("admin.suspend_user failed", target_user=user_id)
        raise HTTPException(status_code=400, detail="Could not suspend user")


@router.post("/unsuspend-user/{user_id}")
@limiter.limit("30/minute")
def unsuspend_user(
    request: Request,
    user_id: str,
    current_user: dict = Depends(require_admin),
):
    """Sets users.is_suspended = false for the given user."""
    try:
        res = (
            supabase.table("users")
            .update({"is_suspended": False})
            .eq("id", user_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
        logger.info(
            "admin.unsuspend_user", admin_id=current_user["id"], target_user=user_id
        )
        return {"message": "user_unsuspended", "user_id": user_id}
    except HTTPException:
        raise
    except Exception:
        logger.exception("admin.unsuspend_user failed", target_user=user_id)
        raise HTTPException(status_code=400, detail="Could not unsuspend user")


@router.post("/force-complete-booking/{booking_id}")
@limiter.limit("30/minute")
def force_complete_booking(
    request: Request,
    booking_id: str,
    current_user: dict = Depends(require_admin),
):
    """Sets bookings.status = 'completed' regardless of current state."""
    try:
        res = (
            supabase.table("bookings")
            .update({"status": "completed"})
            .eq("id", booking_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Booking not found")
        logger.info(
            "admin.force_complete_booking",
            admin_id=current_user["id"],
            booking_id=booking_id,
        )
        return {"message": "booking_completed", "booking_id": booking_id}
    except HTTPException:
        raise
    except Exception:
        logger.exception("admin.force_complete_booking failed", booking_id=booking_id)
        raise HTTPException(status_code=400, detail="Could not complete booking")
