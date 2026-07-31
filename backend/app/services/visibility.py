"""
visibility.py — shared discovery-visibility helpers.

Two independent reasons a user disappears for someone else:

1. GLOBAL — `hidden_user_ids`. A user is hidden from discovery (geo-browse,
   post feeds, etc.) when they are in ghost mode (is_ghosted), admin-suspended
   (is_suspended), or soft-deleted (deleted_at IS NOT NULL). Discovery endpoints
   resolve the owning user of each candidate row and drop the ones whose owner
   is hidden. Same answer for every viewer.

2. PER-VIEWER — `blocked_pair_ids`. A block only exists between two people
   (App Store Guideline 1.2(c)). Callers must pass the viewer.

They compose: a feed drops `hidden_user_ids(...) | blocked_pair_ids(...)`.

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


def blocked_pair_ids(sb, viewer_id: str) -> set[str]:
    """
    Return every user id on either side of a block involving `viewer_id`:
    people the viewer blocked, AND people who blocked the viewer.

    Blocks are STORED one-way (user_blocks.blocker_id -> blocked_id) but are
    ENFORCED symmetrically. App Store Guideline 1.2(c) asks for "a mechanism to
    block abusive users"; a one-way block that still lets the abuser open a
    thread, quote a job, or appear in the feed does not deliver that. So both
    directions collapse into one opaque set of "ids this viewer must not see and
    must not be reachable by".

    Best-effort, but note the fail direction differs from hidden_user_ids():
    that one fails OPEN because a broken lookup must never 500 a feed. This one
    also fails open, for the same reason — a moderation lookup outage must not
    take discovery down — which means callers on the WRITE side (send_message)
    must treat an empty set as "no known block" and not as proof of safety. The
    block is re-checked on read, so a message that slips through an outage is
    still not rendered to the blocked party.
    """
    if not viewer_id:
        return set()
    blocked: set[str] = set()
    try:
        outgoing = (
            sb.table("user_blocks")
            .select("blocked_id")
            .eq("blocker_id", viewer_id)
            .execute()
        )
        incoming = (
            sb.table("user_blocks")
            .select("blocker_id")
            .eq("blocked_id", viewer_id)
            .execute()
        )
    except Exception:
        logger.warning("blocked_pair_ids lookup failed", exc_info=True)
        return set()

    for row in outgoing.data or []:
        if row.get("blocked_id"):
            blocked.add(row["blocked_id"])
    for row in incoming.data or []:
        if row.get("blocker_id"):
            blocked.add(row["blocker_id"])
    return blocked
