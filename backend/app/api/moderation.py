"""
moderation.py — App Store Guideline 1.2 (user-generated content).

Apple will not approve an app carrying UGC unless it ships four things. SwingBy
carries UGC on six surfaces (chat, voice notes, reviews, job posts,
proof-of-work photos, avatars), so all four apply:

  (a) filter objectionable material   → app/services/content_moderation.py,
                                        applied on write in messages.py
  (b) report objectionable content    → POST /moderation/reports  (this module)
  (c) block abusive users             → POST /moderation/blocks   (this module)
  (d) published contact information   → support@swingbyy.com, in-app

Endpoints
---------
POST   /moderation/reports
    Auth: any signed-in user. Body: {target_type, target_id, reason, details?}
    Resolves the owning user of the target once, at write time, and denormalises
    it onto the row (see services/moderation.py::TARGETS). 409 if this reporter
    already has an OPEN report against the same target.

GET    /moderation/reports/mine
    Auth: any signed-in user. Reports the caller filed, newest first. This is
    what turns "we take reports" into something the reporter can verify, which
    App Review does look for.

GET    /moderation/reports/admin/queue
    Auth: admin. Unresolved reports, newest first, with the reported user and a
    repeat-offender count inlined.

PATCH  /moderation/reports/{report_id}/resolve
    Auth: admin. Body: {action_taken, resolution?}
    Applies the consequence (hide the content / suspend the user) and closes the
    report. Resolving twice is a 409 — the second call would suspend again, or
    hide something an admin has since un-hidden by hand.

POST   /moderation/blocks           Body: {blocked_id, reason?}
DELETE /moderation/blocks/{user_id}
GET    /moderation/blocks
    Auth: any signed-in user. Blocks are stored one-way and enforced
    symmetrically — see services/visibility.py::blocked_pair_ids.

Modelled on disputes.py, which is the closest existing report → admin-resolution
arc in this codebase (same 409-on-duplicate, same 409-on-double-resolve, same
audit trail, same literal-path-before-parameterised-path ordering).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.admin import require_admin
from app.deps import get_current_user
from app.limiter import limiter
from app.supabase_client import supabase
from app.services import moderation as moderation_service
from app.services.audit import record_audit
from app.services.visibility import blocked_pair_ids

logger = logging.getLogger(__name__)

router = APIRouter()

# Mirrors the CHECK constraints in migration 20260731090000. Duplicated here so a
# bad value is a 400 with a readable list rather than a Postgres constraint error
# surfacing as a 500 — same reason disputes.py keeps VALID_ISSUE_TYPES.
VALID_TARGET_TYPES = set(moderation_service.TARGETS)

VALID_REASONS = {
    "spam",
    "harassment",
    "hate_speech",
    "sexual_content",
    "violence",
    "scam_or_fraud",
    "off_platform_solicitation",
    "other",
}

VALID_ACTIONS = {"none", "content_hidden", "user_warned", "user_suspended"}

OPEN_STATUSES = ["open", "under_review"]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ReportCreate(BaseModel):
    target_type: str = Field(..., min_length=1)
    target_id: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)
    details: str | None = Field(default=None, max_length=2000)


class ReportResolve(BaseModel):
    action_taken: str = Field(..., min_length=1)
    resolution: str | None = Field(default=None, max_length=1000)


class BlockCreate(BaseModel):
    blocked_id: str = Field(..., min_length=1)
    reason: str | None = Field(default=None, max_length=500)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


@router.post("/reports")
@limiter.limit("20/minute")
def create_report(
    request: Request,
    body: ReportCreate,
    current_user: dict = Depends(get_current_user),
):
    """File a report against a piece of content or a user (Guideline 1.2(b))."""
    if body.target_type not in VALID_TARGET_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"target_type must be one of {sorted(VALID_TARGET_TYPES)}",
        )
    if body.reason not in VALID_REASONS:
        raise HTTPException(
            status_code=400, detail=f"reason must be one of {sorted(VALID_REASONS)}"
        )

    uid = current_user["id"]

    # Resolve the owner ONCE, here, so the admin queue never has to. None is an
    # acceptable answer (deleted row) — see resolve_target_owner's docstring.
    reported_user_id = moderation_service.resolve_target_owner(
        body.target_type, body.target_id
    )

    if reported_user_id and reported_user_id == uid:
        raise HTTPException(
            status_code=400, detail="You cannot report your own content"
        )

    existing = (
        supabase.table("content_reports")
        .select("id, status")
        .eq("reporter_id", uid)
        .eq("target_type", body.target_type)
        .eq("target_id", body.target_id)
        .in_("status", OPEN_STATUSES)
        .execute()
    )
    if existing.data:
        # The partial unique index enforces this too; catching it here turns a
        # constraint violation into a sentence the app can show.
        raise HTTPException(
            status_code=409,
            detail="You have already reported this — it's being reviewed",
        )

    row = {
        "reporter_id": uid,
        "target_type": body.target_type,
        "target_id": body.target_id,
        "reported_user_id": reported_user_id,
        "reason": body.reason,
        "details": (body.details or "").strip() or None,
        "status": "open",
    }
    created = supabase.table("content_reports").insert(row).execute()
    report = (created.data or [None])[0]
    if not report:
        raise HTTPException(status_code=500, detail="Could not file the report")

    record_audit(
        actor_id=uid,
        action="moderation.report_created",
        resource_type="content_report",
        resource_id=report.get("id"),
        metadata={
            "target_type": body.target_type,
            "target_id": body.target_id,
            "reason": body.reason,
        },
        request=request,
    )

    return report


@router.get("/reports/mine")
def list_my_reports(current_user: dict = Depends(get_current_user)):
    """Reports the caller filed. Auto-filed rows are excluded — see below."""
    uid = current_user["id"]
    res = (
        supabase.table("content_reports")
        .select("*")
        .eq("reporter_id", uid)
        # An auto-filed report (content_moderation FLAG) is stored with the
        # author as reporter_id, which would otherwise show up in their own
        # "reports I filed" list as something they never did. reported_user_id
        # is NULL on exactly those rows and never on a human-filed one.
        .not_.is_("reported_user_id", "null")
        .order("created_at", desc=True)
        .execute()
    )
    items = res.data or []
    return {"items": items, "count": len(items)}


@router.get("/reports/admin/queue")
def admin_report_queue(current_user: dict = Depends(require_admin)):
    """Everything awaiting an admin decision, newest first.

    Literal path, declared before any parameterised /reports/{...} route so it
    cannot be shadowed — the same trap documented at disputes.py:211.

    `reported_user_report_count` is the signal an admin actually acts on: one
    complaint is noise, five against the same account is a pattern. It is
    computed here, in one extra query for the whole page, rather than per row.
    """
    res = (
        supabase.table("content_reports")
        .select(
            "*, reporter:users!content_reports_reporter_id_fkey(id, first_name, last_name), "
            "reported:users!content_reports_reported_user_id_fkey(id, first_name, last_name, is_suspended)"
        )
        .in_("status", OPEN_STATUSES)
        .order("created_at", desc=True)
        .execute()
    )
    items = list(res.data or [])

    reported_ids = sorted(
        {r["reported_user_id"] for r in items if r.get("reported_user_id")}
    )
    counts: dict[str, int] = {}
    if reported_ids:
        try:
            all_for_users = (
                supabase.table("content_reports")
                .select("reported_user_id")
                .in_("reported_user_id", reported_ids)
                .execute()
            )
            for row in all_for_users.data or []:
                rid = row.get("reported_user_id")
                if rid:
                    counts[rid] = counts.get(rid, 0) + 1
        except Exception:
            logger.warning("repeat-offender count failed", exc_info=True)

    for row in items:
        row["reported_user_report_count"] = counts.get(row.get("reported_user_id"), 0)

    # Repeat offenders first, then oldest-waiting — the same "what needs a
    # decision most" ordering admin_dispute_queue uses.
    items.sort(
        key=lambda r: (-r["reported_user_report_count"], r.get("created_at") or "")
    )
    return {"items": items, "count": len(items)}


@router.patch("/reports/{report_id}/resolve")
def resolve_report(
    report_id: str,
    body: ReportResolve,
    request: Request,
    current_user: dict = Depends(require_admin),
):
    """Apply a consequence and close the report (admin only)."""
    if body.action_taken not in VALID_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"action_taken must be one of {sorted(VALID_ACTIONS)}",
        )

    existing = (
        supabase.table("content_reports")
        .select("id, target_type, target_id, reported_user_id, status")
        .eq("id", report_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Report not found")
    report = existing.data

    if report["status"] in ("resolved", "dismissed"):
        # Same guard as disputes.py:367 — deciding twice would suspend an already
        # -suspended user again, or re-hide content an admin has since restored.
        raise HTTPException(
            status_code=409, detail=f"This report is already {report['status']}"
        )

    action = body.action_taken

    if action == "content_hidden":
        try:
            moderation_service.hide_content(report["target_type"], report["target_id"])
        except moderation_service.ModerationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    if action == "user_suspended":
        if not report.get("reported_user_id"):
            raise HTTPException(
                status_code=400,
                detail="This report has no resolved user to suspend",
            )
        try:
            moderation_service.suspend_user(report["reported_user_id"])
        except moderation_service.TargetNotFound:
            raise HTTPException(status_code=404, detail="Reported user not found")
        except moderation_service.ModerationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    # 'none' is the dismissal: reviewed, nothing wrong. Everything else stands as
    # a substantiated report.
    final_status = "dismissed" if action == "none" else "resolved"

    updated = (
        supabase.table("content_reports")
        .update(
            {
                "status": final_status,
                "action_taken": action,
                "resolution_notes": (body.resolution or "").strip() or None,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolved_by": current_user["id"],
            }
        )
        .eq("id", report_id)
        .execute()
    )
    row = (updated.data or [None])[0]
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")

    record_audit(
        actor_id=current_user["id"],
        action="moderation.report_resolved",
        resource_type="content_report",
        resource_id=report_id,
        metadata={
            "action_taken": action,
            "target_type": report["target_type"],
            "reported_user_id": report.get("reported_user_id"),
        },
        request=request,
    )

    return row


# ---------------------------------------------------------------------------
# Blocks
# ---------------------------------------------------------------------------


@router.post("/blocks")
@limiter.limit("30/minute")
def create_block(
    request: Request,
    body: BlockCreate,
    current_user: dict = Depends(get_current_user),
):
    """Block another user (Guideline 1.2(c)). Idempotent."""
    uid = current_user["id"]
    if body.blocked_id == uid:
        raise HTTPException(status_code=400, detail="You cannot block yourself")

    target = (
        supabase.table("users")
        .select("id")
        .eq("id", body.blocked_id)
        .limit(1)
        .execute()
    )
    if not (target.data or []):
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        supabase.table("user_blocks")
        .select("*")
        .eq("blocker_id", uid)
        .eq("blocked_id", body.blocked_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        # Idempotent rather than 409: the user's intent is "I don't want to hear
        # from this person", and that is already true. Erroring here would make
        # a double-tap look like a failure to block.
        return existing.data[0]

    created = (
        supabase.table("user_blocks")
        .insert(
            {
                "blocker_id": uid,
                "blocked_id": body.blocked_id,
                "reason": (body.reason or "").strip() or None,
            }
        )
        .execute()
    )
    row = (created.data or [None])[0]
    if not row:
        raise HTTPException(status_code=500, detail="Could not block this user")

    record_audit(
        actor_id=uid,
        action="moderation.user_blocked",
        resource_type="user",
        resource_id=body.blocked_id,
        request=request,
    )
    return row


@router.delete("/blocks/{user_id}")
def remove_block(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Unblock. Idempotent — removing a block that is not there is a success."""
    uid = current_user["id"]
    supabase.table("user_blocks").delete().eq("blocker_id", uid).eq(
        "blocked_id", user_id
    ).execute()

    record_audit(
        actor_id=uid,
        action="moderation.user_unblocked",
        resource_type="user",
        resource_id=user_id,
        request=request,
    )
    return {"message": "unblocked", "user_id": user_id}


@router.get("/blocks")
def list_blocks(current_user: dict = Depends(get_current_user)):
    """Accounts the caller has blocked — the Settings → Safety list.

    Only OUTGOING blocks. Who blocked *you* is deliberately not disclosed: it is
    enforced (blocked_pair_ids is symmetric) but never shown, because telling
    someone they have been blocked is how a block becomes an escalation.
    """
    uid = current_user["id"]
    res = (
        supabase.table("user_blocks")
        .select(
            "*, blocked:users!user_blocks_blocked_id_fkey(id, first_name, last_name, avatar_url)"
        )
        .eq("blocker_id", uid)
        .order("created_at", desc=True)
        .execute()
    )
    items = res.data or []
    return {"items": items, "count": len(items)}


@router.get("/blocks/check/{user_id}")
def check_block(user_id: str, current_user: dict = Depends(get_current_user)):
    """Is there a block in EITHER direction between the caller and `user_id`?

    The chat screen needs this to render a "you can't reply in this thread"
    state instead of letting the user type a message that will 403 on send.
    Returns a single boolean by design — the caller must not learn which
    direction the block runs in.
    """
    pair = blocked_pair_ids(supabase, current_user["id"])
    return {"blocked": user_id in pair}
