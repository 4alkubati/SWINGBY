"""
audit.py — best-effort writes to the `audit_log` table for privileged actions.

Every privileged/admin mutation (user suspension, force-complete, dispute
resolution, ...) should leave an immutable trail here. Writes are best-effort:
a logging failure must NEVER break the action that triggered it, so callers can
fire-and-forget. The insert shape matches the live `audit_log` columns:

    id           uuid   (default gen_random_uuid())
    actor_id     uuid   nullable  -> the acting user
    action       text   NOT NULL  -> short verb, e.g. "admin.suspend_user"
    resource_type text  nullable  -> e.g. "user", "booking", "dispute"
    resource_id  uuid   nullable  -> the affected row id
    metadata     jsonb  NOT NULL  -> arbitrary context (defaults to {})
    ip           text   nullable  -> caller IP
    created_at   timestamptz NOT NULL (default now())
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request

from app.supabase_client import supabase

logger = logging.getLogger(__name__)


def client_ip(request: Optional[Request]) -> Optional[str]:
    """Best-effort extraction of the real client IP (mirrors auth._remote_ip)."""
    if request is None:
        return None
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def record_audit(
    *,
    actor_id: Optional[str],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
    ip: Optional[str] = None,
) -> None:
    """
    Insert one audit_log row. Best-effort — swallows all errors so a failed
    audit write can never break the privileged action it is recording.
    """
    try:
        row = {
            "actor_id": actor_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "metadata": metadata or {},
            "ip": ip if ip is not None else client_ip(request),
        }
        supabase.table("audit_log").insert(row).execute()
    except Exception:
        logger.warning(
            "audit_log write failed action=%s resource_type=%s resource_id=%s",
            action,
            resource_type,
            resource_id,
            exc_info=True,
        )
