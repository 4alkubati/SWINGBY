"""Who can be assigned to a job — and the solo-owner case, in one place.

Why this module exists
----------------------
"Is this business a one-person operation?" was being answered in three places
with three slightly different queries, and getting it wrong is expensive in
both directions:

* **Counting the owner as staff** is SB-0223 — `_resolve_tier_and_price` did
  exactly that, so the first job a solo operator assigned themselves moved them
  onto team pricing permanently.
* **Not materialising the owner as an assignee** is the W3 dead end — a solo
  operator never sees an assign screen, so a booking with `employee_id = NULL`
  hit "Assign someone to this job before marking it complete" on a job they had
  actually finished, with the money stuck behind the guard meant to protect it.

The rule, stated once: **the owner is not their own employee for the purposes
of counting staff, but they ARE a legitimate assignee.** `employees` carries a
row for the owner (created on first use) so that assignment has something real
to point at; every roster COUNT must exclude it.

Failure posture is the caller's decision, not this module's. `other_active_staff`
raises so a money path can fail closed rather than guessing "solo" when it
cannot see the roster; `ensure_owner_employee` returns None instead of raising,
because its callers degrade a picker rather than 500 a screen.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.supabase_client import supabase as _default_client

logger = logging.getLogger(__name__)


def _client(client=None):
    """The Supabase client to use.

    Callers pass their OWN module-level `supabase` name. That is not ceremony:
    the api modules are tested by patching `app.api.bookings.supabase`, and a
    helper that reached for its own import would quietly bypass every one of
    those stubs and hit the network in tests. Injecting keeps the seam where
    the tests already put it.
    """
    return client if client is not None else _default_client


OWNER_ROLE_TITLE = "Owner"

EMPLOYEE_COLUMNS = (
    "id, business_id, user_id, role_title, avatar_url, is_active, created_at, "
    "users(first_name, last_name, avatar_url)"
)


def _rows(res) -> list[dict]:
    """PostgREST results as a list, whether the query used .single() or not."""
    data = getattr(res, "data", None)
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    return [data] if isinstance(data, dict) else []


def other_active_staff(business_id: str, owner_user_id: str, client=None) -> list[dict]:
    """Active employees who are NOT the owner.

    RAISES on a read failure. Callers on a money path must fail closed: an
    empty list has to mean "verified solo", never "could not look".
    """
    if not business_id:
        return []
    res = (
        _client(client)
        .table("employees")
        .select("id, user_id, is_active")
        .eq("business_id", business_id)
        .execute()
    )
    return [
        e
        for e in _rows(res)
        if e.get("is_active", True) and e.get("user_id") != owner_user_id
    ]


def is_solo(business_id: str, owner_user_id: str, client=None) -> bool:
    """True when the owner is the only person who can do the work.

    Raises whatever :func:`other_active_staff` raises — see its note.
    """
    return not other_active_staff(business_id, owner_user_id, client)


def ensure_owner_employee(
    business_id: str, owner_user_id: str, client=None
) -> Optional[dict]:
    """The owner's own `employees` row, created on first use.

    Returns None only if the read AND the write both fail — callers treat that
    as "no roster" rather than raising, so a Supabase hiccup degrades the
    picker instead of 500ing the screen.
    """
    if not business_id or not owner_user_id:
        return None
    try:
        existing = _rows(
            _client(client)
            .table("employees")
            .select(EMPLOYEE_COLUMNS)
            .eq("business_id", business_id)
            .eq("user_id", owner_user_id)
            .limit(1)
            .execute()
        )
        if existing:
            return existing[0]
    except Exception:
        logger.warning(
            "owner employee lookup failed for business %s", business_id, exc_info=True
        )
        return None

    try:
        _client(client).table("employees").insert(
            {
                "business_id": business_id,
                "user_id": owner_user_id,
                "role_title": OWNER_ROLE_TITLE,
                "is_active": True,
            }
        ).execute()
    except Exception:
        # A concurrent request may have won the race against the unique index
        # added by migration 20260725220000 — fall through and re-read.
        logger.warning(
            "owner employee insert failed for business %s", business_id, exc_info=True
        )

    try:
        return (
            _rows(
                _client(client)
                .table("employees")
                .select(EMPLOYEE_COLUMNS)
                .eq("business_id", business_id)
                .eq("user_id", owner_user_id)
                .limit(1)
                .execute()
            )
            or [None]
        )[0]
    except Exception:
        logger.warning(
            "owner employee re-read failed for business %s", business_id, exc_info=True
        )
        return None


def solo_owner_assignee_id(
    business_id: str, owner_user_id: str, client=None
) -> Optional[str]:
    """The employees.id to auto-assign a new booking to, or None.

    None means "do not auto-assign" and covers three different situations
    deliberately collapsed into one answer, because the caller's response to
    all three is identical — leave `employee_id` NULL and let a human choose:

      * the business has other active staff (the owner must pick);
      * the roster could not be read (never guess "solo" from a failed query);
      * the owner's employees row could not be created or re-read.

    Auto-assigning at BOOKING CREATION rather than at completion is the point.
    `/complete` already back-fills the owner as a last resort, but until then a
    solo operator's booking sits with `employee_id = NULL`, so live tracking,
    the job screens and the assignee list all describe a job nobody is doing.
    """
    if not business_id or not owner_user_id:
        return None
    try:
        if other_active_staff(business_id, owner_user_id, client):
            return None
    except Exception:
        logger.warning(
            "roster lookup failed for business %s — not auto-assigning",
            business_id,
            exc_info=True,
        )
        return None

    owner_row = ensure_owner_employee(business_id, owner_user_id, client)
    return (owner_row or {}).get("id") or None
