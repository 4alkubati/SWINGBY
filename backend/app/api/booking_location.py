"""
booking_location.py — WALKTHROUGH M7 (second half): live provider location.

The "On my way" button already exists (JobManagementScreen → POST
/bookings/{id}/events {event_type:'en_route'}) and the client already renders an
`en_route` step in the timeline. What did not exist anywhere in the repo was the
LOCATION: the client saw the words "On the way" and nothing else.

This module is the missing half. It is deliberately small and deliberately
paranoid, because a person's live position is the most sensitive thing this app
has ever moved — the same class of data as the client home photos that were the
walkthrough's worst finding (L3).

Endpoints (mounted under /bookings)
-----------------------------------
PUT    /bookings/{id}/location   provider pushes their current position
GET    /bookings/{id}/location   the client on that booking reads the latest
DELETE /bookings/{id}/location   provider stops sharing, now

THE SHARING WINDOW — the whole privacy model in one sentence
------------------------------------------------------------
Position may be written and read ONLY while the booking's own event timeline
says the provider is en route, and the window is computed server-side from
`booking_events` on every single request. It is never a flag the client app
sets, and never a flag the provider app sets — both of those can lie, and a
stale one leaks a person's location indefinitely.

    OPEN   the latest lifecycle event is `en_route`
    CLOSED anything else, including no events at all

`arrived` closes the window along with `started` / `completed` /
`cancelled_event`. The brief only required stopping at start/complete/cancel,
but a provider who has tapped Arrived is by definition no longer en route and
the client can see them out the window — holding the channel open past that
point buys the product nothing and costs the provider privacy. Closing is also
enforced on the READ side, not just the write side, so a provider app that is
killed mid-drive (and therefore never sends a stop) still stops being visible
the instant the job moves on.

DIRECTION — provider → client, never the reverse
------------------------------------------------
Only a provider party (business owner of the booking, or its assigned employee)
can WRITE. The client can never write here, so there is no path by which a
client's position reaches a business. On READ, coordinates are returned to
exactly two principals: the client on that booking, and the provider who wrote
the row (so their own app can honestly show "you are sharing"). Any other party
to the booking gets a 200 with `sharing: false` and no coordinates; anyone who
is not a party at all gets 403.

NO TRAIL
--------
`booking_locations` holds at most ONE row per booking and every push UPSERTs it.
There is no history table and no append log. A trail would be a permanent,
subpoena-able record of where a worker drove, for a feature whose entire product
value is the word "now" — the second-latest position has never been rendered
anywhere and never will be. The row is deleted when the window closes (on the
explicit DELETE, and lazily on the first read after close), so the steady state
between jobs is: nothing stored.

MIGRATION NOT YET APPLIED
-------------------------
supabase/migrations/20260726130000_live_provider_location.sql is FILED, NOT
APPLIED. Every statement against `booking_locations` in this module is wrapped
so that a missing table degrades to "no location available" (HTTP 200,
`available: false`) instead of a 500. The sharing-window logic reads
`booking_events`, which does exist, so the privacy gates are live and correct
even before the table lands.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


# The event that opens the window, and everything that shuts it. Both sets are
# subsets of booking_events._ALLOWED_EVENT_TYPES — an event type outside both is
# irrelevant to en-route-ness (e.g. `dates_proposed`) and is skipped rather than
# treated as a close, so proposing a new date mid-drive cannot blank the map.
OPEN_EVENT = "en_route"
CLOSE_EVENTS = frozenset(
    {"arrived", "started", "paused", "resumed", "completed", "cancelled_event"}
)

# Booking statuses that end the relationship outright. Checked in addition to
# the event timeline: a booking cancelled through the cancellation flow may
# never get a `cancelled_event` row, and must still stop broadcasting.
TERMINAL_STATUSES = frozenset({"completed", "cancelled"})

# A position older than this is not "live" any more — the provider app was
# backgrounded or lost signal. Still returned (with its true age, so the client
# can say "last updated 4 min ago" honestly) but flagged stale so the UI can
# stop pretending the dot is moving.
STALE_AFTER_SECONDS = 120


# ── Payloads ─────────────────────────────────────────────────────────────────


class LocationIn(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    # Metadata the OS hands us for free. All optional: a fix with no accuracy
    # reading is still a usable fix, and rejecting it would blank the map.
    accuracy_m: Optional[float] = Field(None, ge=0, le=100000)
    heading: Optional[float] = Field(None, ge=0, lt=360)
    speed_mps: Optional[float] = Field(None, ge=0, le=200)


# ── Booking + party helpers (same shape as booking_events.py so the two agree) ─


def _load_booking(booking_id: str) -> dict:
    res = (
        supabase.table("bookings")
        .select("id, client_id, business_id, employee_id, status")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    return res.data


def _is_client(booking: dict, current_user: dict) -> bool:
    return booking.get("client_id") == current_user["id"]


def _is_provider(booking: dict, current_user: dict) -> bool:
    """The business owner of this booking, or its assigned employee."""
    uid = current_user["id"]
    role = current_user["role"]

    if role == "business_owner":
        try:
            biz = (
                supabase.table("businesses")
                .select("id")
                .eq("owner_id", uid)
                .single()
                .execute()
            )
        except Exception:
            return False
        if biz.data and biz.data["id"] == booking["business_id"]:
            return True

    if role == "employee":
        try:
            emp = (
                supabase.table("employees")
                .select("id")
                .eq("user_id", uid)
                .single()
                .execute()
            )
        except Exception:
            return False
        if emp.data and emp.data["id"] == booking.get("employee_id"):
            return True

    return False


# ── The sharing window ───────────────────────────────────────────────────────


def window_is_open(booking: dict, events: list[dict]) -> bool:
    """Pure function — the single definition of "is location allowed right now".

    Unit-tested directly; every endpoint below routes through it. `events` is
    expected newest-first (that is how _recent_events queries), but the function
    does not depend on the caller's ordering being complete: it takes the first
    row it recognises, which for a newest-first list is the latest lifecycle
    event.
    """
    if (booking.get("status") or "").lower() in TERMINAL_STATUSES:
        return False

    for ev in events or []:
        et = ev.get("event_type")
        if et == OPEN_EVENT:
            return True
        if et in CLOSE_EVENTS:
            return False
    # No lifecycle event at all: nobody has said they are on the way.
    return False


def _recent_events(booking_id: str) -> list[dict]:
    """Latest lifecycle events, newest first.

    A short limit is enough: we only care about the most recent one, and pulling
    a handful covers a burst of events written in the same second whose
    created_at ties.
    """
    try:
        res = (
            supabase.table("booking_events")
            .select("event_type, created_at")
            .eq("booking_id", booking_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return res.data or []
    except Exception:
        # Fail CLOSED. If we cannot prove the provider is en route, we do not
        # move anyone's location.
        logger.warning(
            "could not read booking_events for location window on %s",
            booking_id,
            exc_info=True,
        )
        return []


def _is_sharing_open(booking_id: str, booking: dict) -> bool:
    return window_is_open(booking, _recent_events(booking_id))


# ── Storage (every call degrades instead of raising) ─────────────────────────


def _read_row(booking_id: str) -> Optional[dict]:
    try:
        res = (
            supabase.table("booking_locations")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        return res.data or None
    except Exception:
        # Two indistinguishable-and-equivalent cases: no row yet (PostgREST
        # .single() raises on zero rows) or the table has not been migrated in.
        # Both mean "no location to show".
        return None


def _write_row(booking_id: str, payload: dict) -> Optional[dict]:
    """UPSERT the single row for this booking. Returns None if storage is absent."""
    try:
        res = (
            supabase.table("booking_locations")
            .upsert({"booking_id": booking_id, **payload}, on_conflict="booking_id")
            .execute()
        )
        return (res.data or [{"booking_id": booking_id, **payload}])[0]
    except Exception:
        logger.warning(
            "booking_locations upsert failed for %s (table may not be migrated yet)",
            booking_id,
            exc_info=True,
        )
        return None


def _delete_row(booking_id: str) -> bool:
    try:
        supabase.table("booking_locations").delete().eq(
            "booking_id", booking_id
        ).execute()
        return True
    except Exception:
        logger.warning(
            "booking_locations delete failed for %s", booking_id, exc_info=True
        )
        return False


# ── Shaping ──────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _age_seconds(updated_at) -> Optional[int]:
    if not updated_at:
        return None
    try:
        raw = str(updated_at).replace("Z", "+00:00")
        ts = datetime.fromisoformat(raw)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None
    return max(0, int((_now() - ts).total_seconds()))


def public_location(row: Optional[dict]) -> Optional[dict]:
    """The exact shape the client is allowed to see. Nothing else from the row.

    Whitelisted rather than `{**row}` on purpose: a column added to this table
    later (a device id, a battery level, an internal note) must not start
    reaching the client the day it is added.
    """
    if not row:
        return None
    age = _age_seconds(row.get("updated_at"))
    return {
        "lat": row.get("lat"),
        "lng": row.get("lng"),
        "accuracy_m": row.get("accuracy_m"),
        "heading": row.get("heading"),
        "updated_at": row.get("updated_at"),
        "age_seconds": age,
        "is_stale": age is None or age > STALE_AFTER_SECONDS,
    }


def _closed(available: bool = True, reason: str = "not_en_route") -> dict:
    return {
        "sharing": False,
        "location": None,
        "available": available,
        "reason": reason,
        "stale_after_seconds": STALE_AFTER_SECONDS,
    }


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.put("/{booking_id}/location")
def push_location(
    booking_id: str,
    data: LocationIn,
    current_user: dict = Depends(get_current_user),
):
    """Provider pushes their current position.

    Returns `sharing` so the caller learns the window has closed from the same
    round-trip it uses to push — the mobile hook stops on `sharing: false` and
    needs no second endpoint to ask. A closed window is NOT an error: the app
    racing one last fix against the Arrived tap is normal, not a fault.
    """
    booking = _load_booking(booking_id)

    if not _is_provider(booking, current_user):
        # Deliberately not distinguishing "you are the client" from "you are a
        # stranger": neither may ever write a position onto a booking.
        raise HTTPException(
            status_code=403,
            detail="Only the assigned business owner or employee can share a location",
        )

    if not _is_sharing_open(booking_id, booking):
        # Close the loop rather than just refusing: if a stale row survived (app
        # killed mid-drive, no DELETE ever sent), this is where it dies.
        _delete_row(booking_id)
        return _closed()

    row = _write_row(
        booking_id,
        {
            "provider_id": current_user["id"],
            "lat": data.lat,
            "lng": data.lng,
            "accuracy_m": data.accuracy_m,
            "heading": data.heading,
            "speed_mps": data.speed_mps,
            "updated_at": _now().isoformat(),
        },
    )

    if row is None:
        return {
            "sharing": True,
            "stored": False,
            "available": False,
            "reason": "storage_unavailable",
            "stale_after_seconds": STALE_AFTER_SECONDS,
        }

    return {
        "sharing": True,
        "stored": True,
        "available": True,
        "location": public_location(row),
        "stale_after_seconds": STALE_AFTER_SECONDS,
    }


@router.get("/{booking_id}/location")
def get_location(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """The client on this booking reads the provider's latest position.

    Everything is re-derived here — party check, window check, freshness — so a
    single GET is a complete authorisation decision and no caller can hold a
    reference to a location that has since become private.
    """
    booking = _load_booking(booking_id)

    is_client = _is_client(booking, current_user)
    is_provider = _is_provider(booking, current_user)

    if not (is_client or is_provider):
        raise HTTPException(status_code=403, detail="Access denied")

    if not _is_sharing_open(booking_id, booking):
        _delete_row(booking_id)
        return _closed()

    row = _read_row(booking_id)
    if not row:
        return _closed(reason="no_fix_yet")

    if not is_client:
        # A provider party who is not the person actually driving (e.g. the
        # owner while an employee runs the job) is a party to the booking but
        # not a recipient of this feed. Location flows provider → client only,
        # so they get the honest "nothing for you here" rather than a colleague's
        # coordinates or a confusing 403 on a booking that is genuinely theirs.
        if row.get("provider_id") != current_user["id"]:
            return _closed(reason="not_shared_with_you")

    return {
        "sharing": True,
        "available": True,
        "location": public_location(row),
        "stale_after_seconds": STALE_AFTER_SECONDS,
    }


@router.delete("/{booking_id}/location")
def stop_sharing(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Provider stops sharing immediately — the manual kill switch.

    Allowed regardless of the window: "stop showing my position" must never be
    refused because of the state of something else.
    """
    booking = _load_booking(booking_id)

    if not _is_provider(booking, current_user):
        raise HTTPException(
            status_code=403,
            detail="Only the assigned business owner or employee can stop sharing",
        )

    _delete_row(booking_id)
    return {"sharing": False, "stopped": True}
