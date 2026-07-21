"""
visibility.py — shared discovery-visibility helper.

A user is hidden from discovery (geo-browse, post feeds, etc.) when they are
in ghost mode (is_ghosted), admin-suspended (is_suspended), or soft-deleted
(deleted_at IS NOT NULL). Discovery endpoints resolve the owning user of each
candidate row and drop the ones whose owner is hidden.

The Supabase client is passed in by the caller (rather than imported here) so
that per-module `patch("app.api.<module>.supabase")` test doubles keep working.
"""

from __future__ import annotations

import logging
from typing import Iterable

logger = logging.getLogger(__name__)


def hidden_user_ids(sb, user_ids: Iterable[str]) -> set[str]:
    """
    Return the subset of `user_ids` that should be hidden from discovery.
    Best-effort: on any error returns an empty set (fail-open for discovery,
    matching the existing "never 500 the feed" posture of these endpoints).
    """
    ids = sorted({uid for uid in user_ids if uid})
    if not ids:
        return set()
    try:
        res = (
            sb.table("users")
            .select("id, is_ghosted, is_suspended, deleted_at")
            .in_("id", ids)
            .execute()
        )
    except Exception:
        logger.warning("hidden_user_ids lookup failed", exc_info=True)
        return set()

    hidden: set[str] = set()
    for row in res.data or []:
        if row.get("is_ghosted") or row.get("is_suspended") or row.get("deleted_at"):
            hidden.add(row["id"])
    return hidden
