"""
admin.py — Admin-only endpoints for the SwingBy backend.

T27  Admin user/booking management:
     - GET  /admin/users
     - GET  /admin/bookings
     - POST /admin/suspend-user/{user_id}
     - POST /admin/unsuspend-user/{user_id}
     - POST /admin/force-complete-booking/{booking_id}

CARD-07 Monitoring verification:
     - GET  /admin/monitoring-probe

Rate limit: 30/minute per IP for all admin endpoints.

NOTE: `users.is_suspended boolean default false` column must exist in the DB.
      Wave 6 migration should add it if not already present.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request

from app.deps import get_current_user
from app.limiter import limiter
from app.supabase_client import supabase
from app.api.waitlist import get_notion, WAITLIST_DB_ID
from app.services.audit import record_audit

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
        record_audit(
            actor_id=current_user["id"],
            action="admin.suspend_user",
            resource_type="user",
            resource_id=user_id,
            request=request,
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
        record_audit(
            actor_id=current_user["id"],
            action="admin.unsuspend_user",
            resource_type="user",
            resource_id=user_id,
            request=request,
        )
        return {"message": "user_unsuspended", "user_id": user_id}
    except HTTPException:
        raise
    except Exception:
        logger.exception("admin.unsuspend_user failed", target_user=user_id)
        raise HTTPException(status_code=400, detail="Could not unsuspend user")


@router.get("/waitlist-count")
@limiter.limit("30/minute")
def waitlist_count(
    request: Request,
    current_user: dict = Depends(require_admin),
):
    """
    Live signup count (audit fault K5 — "waitlist-blind": a 200-signup
    target existed with no tracked actual count driving decisions).

    Source of truth: the SwingBy Waitlist Notion database
    (WAITLIST_DB_ID, see app/api/waitlist.py). BOTH waitlist entry points —
    this backend's POST /waitlist/ and the Cloudflare Worker at
    api.swingbyy.com/waitlist (workers/waitlist/index.js) — write into that
    same database, so there is no separate KV or Postgres store to
    reconcile; a Notion page count over that database IS the true count.

    Paginates the Notion API (100 rows/page, capped at 5,000 total as a
    runaway-loop guard) since `databases.query` doesn't return a total in
    one call.
    """
    try:
        notion = get_notion()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        count = 0
        cursor = None
        for _ in range(50):  # safety cap: 50 * 100 = 5,000 rows
            kwargs = {"database_id": WAITLIST_DB_ID, "page_size": 100}
            if cursor:
                kwargs["start_cursor"] = cursor
            page = notion.databases.query(**kwargs)
            count += len(page.get("results", []))
            if not page.get("has_more"):
                break
            cursor = page.get("next_cursor")
        return {"count": count, "source": "notion", "database_id": WAITLIST_DB_ID}
    except HTTPException:
        raise
    except Exception:
        logger.exception("admin.waitlist_count failed")
        raise HTTPException(status_code=400, detail="Could not fetch waitlist count")


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
        record_audit(
            actor_id=current_user["id"],
            action="admin.force_complete_booking",
            resource_type="booking",
            resource_id=booking_id,
            request=request,
        )
        return {"message": "booking_completed", "booking_id": booking_id}
    except HTTPException:
        raise
    except Exception:
        logger.exception("admin.force_complete_booking failed", booking_id=booking_id)
        raise HTTPException(status_code=400, detail="Could not complete booking")


@router.get("/monitoring-probe")
@limiter.limit("5/minute")
def monitoring_probe(
    request: Request,
    current_user: dict = Depends(require_admin),
):
    """
    CARD-07 — deliberate, admin-only test error for Sentry verification.

    Intentionally left UNCAUGHT (no try/except): the goal is to reach
    FastAPI's default 500 path and let Sentry's FastApiIntegration capture
    a real unhandled exception exactly as it would for a genuine bug, not a
    manually-called capture_message(). Proves the live prod SENTRY_DSN
    actually ingests errors end-to-end, on demand.

    Safe: admin-gated (403 for non-admin), rate-limited (5/min), touches no
    data, no side effects besides one log line + one exception. If
    SENTRY_DSN is unset in this environment, this just 500s with no capture
    (unchanged behavior for the caller either way).

    Usage once deployed:
      curl -H "Authorization: Bearer <admin-jwt>" \
        https://swingbyy-api.onrender.com/admin/monitoring-probe
      -> expect HTTP 500, then check the Sentry issues stream for
         "CARD-07 monitoring probe" within ~1 minute.
    """
    logger.info("card07.monitoring_probe.fired", admin_id=current_user["id"])
    raise RuntimeError(
        "CARD-07 monitoring probe — deliberate test error, safe to ignore"
    )
