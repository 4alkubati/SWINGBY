"""
booking_events.py — Live Job Status timeline endpoints.

A booking_events row is the trust spine of the app: each time the provider
hits Arrived / Start / Complete, we append an immutable event and push the
client. The client's BookingDetails screen polls GET to render a timeline.

Endpoints
---------
POST   /bookings/{booking_id}/events   create a new event (provider-side)
GET    /bookings/{booking_id}/events   list events for a booking (any party)

Authorisation
-------------
- Create: business_owner (of the booking's business) OR assigned employee.
- Read:   client, business owner, OR assigned employee.

Side-effects
------------
This endpoint does NOT release payment, on 'completed' or any other event
type — it only inserts a booking_events row and pushes a notification.
Completion + escrow release happen exclusively through
PATCH /bookings/{id}/complete (see bookings.py), which the mobile app calls
via LiveStatusActions -> onAdvance -> PATCH /bookings/{id}/complete
(JobManagementScreen.js's StatusTracker/handleAdvance). Do not assume a
'completed' event posted here has moved any money.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from app.deps import get_current_user
from app.supabase_client import supabase
from app.services.push import send_push_to_user
from app.text_safety import ScrubbedText

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

_ALLOWED_EVENT_TYPES = {
    "dates_proposed",
    "date_confirmed",
    "en_route",
    "arrived",
    "started",
    "paused",
    "resumed",
    "completed",
    "cancelled_event",
}


class CreateEvent(ScrubbedText):
    event_type: str = Field(..., min_length=1, max_length=32)
    note: Optional[str] = Field(None, max_length=500)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)


# The stages that describe where a job IS. Re-posting the stage a booking is
# already on says nothing new, so it collapses onto the existing row (see
# `_latest_stage_event`). The rest are moments, not stages: `paused` /
# `resumed` legitimately repeat, and `dates_proposed` repeats every time a new
# set of times is offered.
_STAGE_EVENT_TYPES = {
    "en_route",
    "arrived",
    "started",
    "completed",
}


# ── Helpers ──────────────────────────────────────────────────────────────────


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


def _is_party(booking: dict, current_user: dict) -> bool:
    """True if the caller is the client, the business owner, or the assigned employee."""
    uid = current_user["id"]
    role = current_user["role"]

    if booking["client_id"] == uid:
        return True

    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if biz.data and biz.data["id"] == booking["business_id"]:
            return True

    if role == "employee":
        emp = (
            supabase.table("employees")
            .select("id")
            .eq("user_id", uid)
            .single()
            .execute()
        )
        if emp.data and emp.data["id"] == booking.get("employee_id"):
            return True

    return False


def _is_provider(booking: dict, current_user: dict) -> bool:
    """True for business owner of the booking or its assigned employee."""
    uid = current_user["id"]
    role = current_user["role"]

    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if biz.data and biz.data["id"] == booking["business_id"]:
            return True

    if role == "employee":
        emp = (
            supabase.table("employees")
            .select("id")
            .eq("user_id", uid)
            .single()
            .execute()
        )
        if emp.data and emp.data["id"] == booking.get("employee_id"):
            return True

    return False


def _latest_stage_event(booking_id: str) -> Optional[dict]:
    """The most recent stage event on a booking, or None.

    Ordered by ``created_at`` like the list endpoint, so "current stage" means
    the same thing to the guard and to the timeline the provider is looking at.
    A read failure returns None: the guard is a de-duplicator, not an
    authorisation check, and it must never be the reason a real update is lost.
    """
    try:
        res = (
            supabase.table("booking_events")
            .select("*")
            .eq("booking_id", booking_id)
            .in_("event_type", sorted(_STAGE_EVENT_TYPES))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception:
        logger.warning(
            "could not read latest stage event for booking %s",
            booking_id,
            exc_info=True,
        )
        return None


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/{booking_id}/events")
def create_event(
    booking_id: str,
    data: CreateEvent,
    current_user: dict = Depends(get_current_user),
):
    if data.event_type not in _ALLOWED_EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"event_type must be one of: {sorted(_ALLOWED_EVENT_TYPES)}",
        )

    booking = _load_booking(booking_id)

    if not _is_provider(booking, current_user):
        raise HTTPException(
            status_code=403,
            detail="Only the assigned business owner or employee can post job-status events",
        )

    # Idempotency on the stage events. A booking's timeline came back from the
    # 2026-07-29 walkthrough with three consecutive "On the way" rows, because
    # two different controls on the business booking screen both posted
    # `en_route` and neither could tell the stage had already been reached.
    # The UI side of that is fixed, but an append-only trust spine must not
    # depend on the UI to stay coherent: re-posting the stage the job is
    # already on is a no-op that returns the row that already exists.
    if data.event_type in _STAGE_EVENT_TYPES:
        existing = _latest_stage_event(booking_id)
        if existing and existing.get("event_type") == data.event_type:
            logger.info(
                "booking_event %s for booking %s collapsed — already the current stage",
                data.event_type,
                booking_id,
            )
            return existing

    payload = {
        "booking_id": booking_id,
        "actor_id": current_user["id"],
        "event_type": data.event_type,
        "note": data.note,
        "lat": data.lat,
        "lng": data.lng,
    }

    try:
        res = supabase.table("booking_events").insert(payload).execute()
        event = res.data[0] if res.data else payload
    except Exception:
        logger.exception("Could not insert booking_event for booking %s", booking_id)
        raise HTTPException(status_code=400, detail="Could not record event")

    # Best-effort push to the client (silent on failure).
    try:
        _push_client_for_event(booking, data.event_type)
    except Exception:
        logger.warning("push for booking_event failed", exc_info=True)

    return event


@router.get("/{booking_id}/events")
def list_events(
    booking_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    booking = _load_booking(booking_id)

    if not _is_party(booking, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        res = (
            supabase.table("booking_events")
            .select("*")
            .eq("booking_id", booking_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return {"items": res.data or [], "booking_id": booking_id}
    except Exception:
        logger.exception("Could not list booking_events for %s", booking_id)
        raise HTTPException(status_code=400, detail="Could not list events")


# ── Internal helpers ─────────────────────────────────────────────────────────

_PUSH_COPY = {
    "en_route": ("On the way", "Your provider is en route."),
    "arrived": ("Provider arrived", "Your provider has arrived at the job."),
    "started": ("Job started", "Work on your booking has started."),
    "paused": ("Job paused", "Your provider has paused the job."),
    "resumed": ("Job resumed", "Your provider has resumed the job."),
    "completed": ("Job complete", "Your provider has marked the job complete."),
    "cancelled_event": (
        "Update on your booking",
        "There is a new update on your booking.",
    ),
}


def _push_client_for_event(booking: dict, event_type: str) -> None:
    title, body = _PUSH_COPY.get(
        event_type, ("Booking update", "There is an update on your booking.")
    )
    client_id = booking.get("client_id")
    if client_id:
        send_push_to_user(
            client_id,
            title,
            body,
            data={"booking_id": booking["id"], "event_type": event_type},
        )
