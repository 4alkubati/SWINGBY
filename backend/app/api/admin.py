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

from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.deps import get_current_user
from app.limiter import limiter
from app.supabase_client import supabase
from app.api.waitlist import get_notion, WAITLIST_DB_ID
from app.services import moderation
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
    """Sets users.is_suspended = true for the given user.

    The body lives in services/moderation.py because the Guideline 1.2 report
    queue suspends through the same path (resolving a report with
    action_taken='user_suspended'). Two copies would be two places that could
    disagree about what suspension means.
    """
    try:
        moderation.suspend_user(user_id)
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
    except moderation.TargetNotFound:
        # Kept as a 404 — the pre-extraction handler returned one, and the admin
        # app distinguishes "no such user" from "could not suspend".
        raise HTTPException(status_code=404, detail="User not found")
    except Exception:
        logger.exception("admin.suspend_user failed", target_user=user_id)
        raise HTTPException(status_code=400, detail="Could not suspend user")


@router.post("/sweeps/approval-releases")
@limiter.limit("12/hour")
def sweep_approval_releases(
    request: Request,
    current_user: dict = Depends(require_admin),
):
    """Release every booking whose 24h client-approval window has closed.

    The PRIMARY mechanism is lazy: `approvals.settle_if_due` runs on every
    booking read, so the answer is right the moment either party looks. This
    endpoint exists for the case where nobody looks — point a cron at it (the
    keep-warm crontab already hits this API every 10 minutes) and stale windows
    settle on their own.

    Deliberately not a public/unauthenticated cron URL: it moves money, so it
    takes the same admin guard as everything else here. Safe to call repeatedly
    — a booking with no closed window is skipped, and a release is idempotent.
    """
    from app.services import approvals

    summary = approvals.settle_due()
    if summary.get("released"):
        logger.info(
            "admin.sweep_approval_releases",
            admin_id=current_user["id"],
            **summary,
        )
        record_audit(
            actor_id=current_user["id"],
            action="admin.sweep_approval_releases",
            resource_type="booking",
            metadata=summary,
            request=request,
        )
    return summary


@router.post("/sweeps/login-attempts")
@limiter.limit("12/hour")
def sweep_login_attempts(
    request: Request,
    current_user: dict = Depends(require_admin),
):
    """Delete `login_attempts` rows past the retention horizon (SB-0071).

    `login_guard.prune_attempts()` existed and had no caller anywhere, while
    the migration's own COMMENT promises a 7-day retention sweep. A function
    nobody calls does not implement a promise: the table grew without bound and
    the claim in the schema was simply false.

    Manual rather than scheduled for the same reason as the two sweeps below —
    this deployment has no APPLICATION scheduler. Safe to call repeatedly; it deletes by
    timestamp, not by a flag.
    """
    from app.services import login_guard

    removed = login_guard.prune_attempts()
    if removed:
        logger.info(
            "admin.sweep_login_attempts",
            admin_id=current_user["id"],
            removed=removed,
        )
        record_audit(
            actor_id=current_user["id"],
            action="admin.sweep_login_attempts",
            metadata={"removed": removed},
            request=request,
        )
    return {"removed": removed}


@router.post("/sweeps/post-expiry")
@limiter.limit("12/hour")
def sweep_post_expiry(
    request: Request,
    current_user: dict = Depends(require_admin),
):
    """Refund and close every expired post that nobody quoted.

    Same shape, and the same reasoning, as the approval-release sweep above:
    the PRIMARY mechanism is lazy (`GET /service-posts/my` sweeps the client's
    own posts, and the business feed hides expired ones), because this
    deployment has no APPLICATION scheduler. This is for the case where the client never
    opens the app again — which, for someone owed a refund on a job that never
    happened, is the likeliest case of all.

    Safe to call repeatedly: an already-refunded post has zero escrow and is
    skipped on the money, not on a flag.
    """
    from app.services import expiry_sweep

    summary = expiry_sweep.sweep_once()
    if summary.get("refunded") or summary.get("failed"):
        logger.info(
            "admin.sweep_post_expiry",
            admin_id=current_user["id"],
            **summary,
        )
        record_audit(
            actor_id=current_user["id"],
            action="admin.sweep_post_expiry",
            resource_type="service_post",
            metadata=summary,
            request=request,
        )
    return summary


@router.post("/unsuspend-user/{user_id}")
@limiter.limit("30/minute")
def unsuspend_user(
    request: Request,
    user_id: str,
    current_user: dict = Depends(require_admin),
):
    """Sets users.is_suspended = false for the given user. Shares the service
    function with suspend_user so both directions stay one implementation."""
    try:
        moderation.suspend_user(user_id, suspended=False)
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
    except moderation.TargetNotFound:
        raise HTTPException(status_code=404, detail="User not found")
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
    """Sets bookings.status = 'completed' and releases escrow like /complete.

    fix G: previously this only flipped status='completed' and bypassed the
    escrow release, leaving the on-platform 50% stuck in escrow forever with no
    route out. Now it runs the SAME release path as PATCH /bookings/{id}/complete
    so the ledger settles. If the booking has no payments row, the completion
    still proceeds (admin override) but is logged for follow-up.
    """
    from app.services import escrow

    try:
        payment_status = "fully_released"
        try:
            escrow.release_escrow_on_complete(booking_id)
        except escrow.EscrowError:
            # No payment row to release — don't block the admin override, but
            # surface it: there's nothing to settle and payment_status is unknown.
            logger.warning(
                "admin.force_complete_booking: no payments row for %s — "
                "completing without escrow release",
                booking_id,
            )
            payment_status = None

        booking_update = {"status": "completed"}
        if payment_status:
            booking_update["payment_status"] = payment_status
        res = (
            supabase.table("bookings")
            .update(booking_update)
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


# ── Endpoints the admin web app has always called, and that never existed ────
#
# Sentinel sweep, 2026-08-01: `web/admin/` calls `GET /admin/businesses`,
# `POST /admin/businesses/{id}/verify` and `GET /admin/audit-log`. None were
# defined, so the Businesses page could never load and license verification —
# which CLAUDE.md documents as "pending → manual verify by SwingBy team" — had
# no working control anywhere, and the Audit Log page fell back to five
# hardcoded fake rows presented as real data.
#
# `web/admin/` is NOT deployed today (docs/DEPLOY.md), so nothing is on fire.
# These are added anyway because the page is the only UI for a documented
# manual process, and because a compliance screen that invents its own contents
# is worse the day someone does deploy it.


@router.get("/businesses")
@limiter.limit("60/minute")
def list_businesses_for_admin(
    request: Request,
    license_status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(require_admin),
):
    """Every business, newest first, for the admin review queue.

    `license_status` narrows to the queue that matters ('pending'), which is
    the reason this endpoint exists.
    """
    limit = max(1, min(int(limit or 100), 200))
    offset = max(0, int(offset or 0))
    try:
        query = supabase.table("businesses").select(
            "id, business_name, category, license_status, owner_id, "
            "avg_rating, review_count, city, created_at, "
            "users(first_name, last_name, email)"
        )
        if license_status:
            query = query.eq("license_status", license_status)
        res = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"items": res.data or [], "limit": limit, "offset": offset}
    except Exception:
        logger.exception("admin.list_businesses failed")
        raise HTTPException(status_code=400, detail="Could not list businesses")


class LicenseVerifyRequest(BaseModel):
    verified: bool


@router.post("/businesses/{business_id}/verify")
@limiter.limit("30/minute")
def set_business_license(
    request: Request,
    business_id: str,
    body: LicenseVerifyRequest,
    current_user: dict = Depends(require_admin),
):
    """Manually verify (or revoke) a business's license.

    The whole of SwingBy's licence checking is this call — a human looks at the
    paperwork and flips the flag. Audited, because "who verified this business
    and when" is the only answer we would have if one turned out not to be
    licensed.
    """
    new_status = "verified" if body.verified else "pending"
    try:
        res = (
            supabase.table("businesses")
            .update({"license_status": new_status})
            .eq("id", business_id)
            .execute()
        )
        if not (res.data or []):
            raise HTTPException(status_code=404, detail="Business not found")
    except HTTPException:
        raise
    except Exception:
        logger.exception("admin.set_business_license failed", business_id=business_id)
        raise HTTPException(status_code=400, detail="Could not update license status")

    logger.info(
        "admin.set_business_license",
        admin_id=current_user["id"],
        business_id=business_id,
        license_status=new_status,
    )
    record_audit(
        actor_id=current_user["id"],
        action="admin.set_business_license",
        resource_type="business",
        resource_id=business_id,
        metadata={"license_status": new_status},
        request=request,
    )
    return {"id": business_id, "license_status": new_status}


@router.get("/audit-log")
@limiter.limit("60/minute")
def read_audit_log(
    request: Request,
    action: Optional[str] = None,
    since: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(require_admin),
):
    """The real `audit_log` table — written by services/audit.record_audit.

    The page that reads this used to fall back to five fabricated rows
    (`PLACEHOLDER_ROWS`) whenever the call failed, with working filters
    operating on the fake data. Real audit rows have existed the whole time;
    nothing exposed them.
    """
    limit = max(1, min(int(limit or 100), 500))
    offset = max(0, int(offset or 0))
    try:
        query = supabase.table("audit_log").select(
            "id, actor_id, action, resource_type, resource_id, metadata, "
            "ip, created_at, users!audit_log_actor_id_fkey(email)"
        )
        if action:
            query = query.eq("action", action)
        if since:
            query = query.gte("created_at", since)
        res = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {"items": res.data or [], "limit": limit, "offset": offset}
    except Exception:
        logger.exception("admin.read_audit_log failed")
        raise HTTPException(status_code=400, detail="Could not read the audit log")
