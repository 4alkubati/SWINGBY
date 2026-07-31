"""
moderation.py — shared moderation actions.

Two callers act on the same user-level consequences:

  * `admin.py`      — the pre-existing manual controls (POST /admin/suspend-user)
  * `moderation.py` — the Guideline 1.2 report queue, where suspending is one of
                      the outcomes an admin can pick when resolving a report

Suspension lived only in `admin.py::suspend_user` and was inseparable from its
HTTP handler. Rather than write a second copy for the report queue — two places
that must stay in step about what "suspended" means — the body moved here and
both endpoints call it. The endpoints keep their own auth, rate limits and audit
records; this module only knows how to change the world.

Nothing here raises HTTPException: these are service functions, and mapping a
failure onto a status code is the caller's job.
"""

from __future__ import annotations

from datetime import datetime, timezone

import structlog

from app.supabase_client import supabase

logger = structlog.get_logger(__name__)


class ModerationError(Exception):
    """A moderation action could not be applied. Callers map this to a 4xx/5xx."""


class TargetNotFound(ModerationError):
    """The user or content row the action names does not exist."""


# Which table/column pair owns each reportable surface. This is the single
# dispatch point for "who wrote this" and "how do I hide it", so adding a new
# reportable surface means adding one row here and one value to the
# content_reports.target_type CHECK — nothing else.
#
#   owner_column  → resolves content_reports.reported_user_id at write time
#   hideable      → whether the row carries a `hidden_at` column (migration
#                   20260731090000). A business or a user has no content to
#                   hide; the consequence there is suspension, not hiding.
TARGETS: dict[str, dict] = {
    "message": {"table": "messages", "owner_column": "sender_id", "hideable": True},
    "review": {"table": "reviews", "owner_column": "reviewer_id", "hideable": True},
    "service_post": {
        "table": "service_posts",
        "owner_column": "client_id",
        "hideable": True,
    },
    "booking_photo": {
        "table": "booking_photos",
        "owner_column": "uploaded_by",
        "hideable": True,
    },
    "voice_note": {
        "table": "booking_voice_notes",
        "owner_column": "recorded_by",
        "hideable": False,
    },
    "business": {"table": "businesses", "owner_column": "owner_id", "hideable": False},
    "user": {"table": "users", "owner_column": "id", "hideable": False},
}


def resolve_target_owner(target_type: str, target_id: str) -> str | None:
    """Return the user id that owns a reportable row, or None.

    None is not an error. A report against a row that has since been deleted (or
    whose owner was scrubbed by me.py's soft delete) must still be filable —
    `content_reports.reported_user_id` is nullable for exactly this reason. What
    we must never do is 500 the reporter, because that is the flow App Review
    will test.
    """
    spec = TARGETS.get(target_type)
    if not spec:
        raise ModerationError(f"Unknown target_type: {target_type}")

    try:
        res = (
            supabase.table(spec["table"])
            .select(spec["owner_column"])
            .eq("id", target_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.warning(
            "moderation.resolve_target_owner failed",
            target_type=target_type,
            target_id=target_id,
            exc_info=True,
        )
        return None

    rows = res.data or []
    if not rows:
        return None
    return rows[0].get(spec["owner_column"])


def hide_content(target_type: str, target_id: str) -> bool:
    """Stamp `hidden_at` on a reported row. Returns True when something changed.

    Soft-hide, never delete: the row has to survive for the admin trail, and on
    `messages` it also has to survive the CRA-retention posture me.py documents.
    Read paths filter on `hidden_at is null`.
    """
    spec = TARGETS.get(target_type)
    if not spec:
        raise ModerationError(f"Unknown target_type: {target_type}")
    if not spec["hideable"]:
        return False

    try:
        res = (
            supabase.table(spec["table"])
            .update({"hidden_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", target_id)
            .execute()
        )
    except Exception:
        logger.exception(
            "moderation.hide_content failed",
            target_type=target_type,
            target_id=target_id,
        )
        raise ModerationError("Could not hide the reported content")

    return bool(res.data)


def file_automatic_report(
    *,
    target_type: str,
    target_id: str,
    author_id: str | None,
    reason: str,
    details: str,
) -> None:
    """File a report on the platform's own behalf, from the content filter.

    Lives here rather than in api/moderation.py so the write path (messages.py)
    does not have to import another API module to reach it.

    Best-effort and silent: this runs inside send_message, and a moderation
    bookkeeping failure must never stop a message the filter decided to ALLOW.

    `reporter_id` is the author themselves — there is no system user row to
    attribute it to, and making reporter_id nullable would weaken the column for
    every human-filed report. Because reporter_id would then equal
    reported_user_id, the row deliberately leaves reported_user_id NULL:
    content_reports_no_self_report rejects the pair otherwise, and NULL is also
    what GET /reports/mine filters on to keep an auto-filed row out of the
    author's own "reports I filed" list. The admin queue resolves the owner from
    target_type/target_id.
    """
    if not author_id:
        # reporter_id is NOT NULL and there is no system user to stand in for
        # the platform. Nothing to write; the send still proceeds.
        return
    try:
        supabase.table("content_reports").insert(
            {
                "reporter_id": author_id,
                "target_type": target_type,
                "target_id": target_id,
                "reported_user_id": None,
                "reason": reason,
                "details": details[:2000],
                "status": "open",
            }
        ).execute()
    except Exception:
        logger.warning(
            "moderation.file_automatic_report failed",
            target_type=target_type,
            target_id=target_id,
            exc_info=True,
        )


def suspend_user(user_id: str, *, suspended: bool = True) -> dict:
    """Set `users.is_suspended`. Raises TargetNotFound if no such user.

    Moved verbatim (minus the HTTP wrapper) out of admin.py::suspend_user so the
    report queue and the manual admin control cannot drift apart about what
    suspension means. `is_suspended` is already read by
    visibility.hidden_user_ids, so flipping it removes the user from discovery
    with no further work here.
    """
    try:
        res = (
            supabase.table("users")
            .update({"is_suspended": suspended})
            .eq("id", user_id)
            .execute()
        )
    except Exception:
        logger.exception("moderation.suspend_user failed", target_user=user_id)
        raise ModerationError("Could not change the user's suspension state")

    if not res.data:
        raise TargetNotFound("User not found")
    return res.data[0]
