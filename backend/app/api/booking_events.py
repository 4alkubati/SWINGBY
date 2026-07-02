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
On 'completed' we also call the existing payment-release path used by
PATCH /bookings/{id}/complete — kept in one place there (we just emit the
event here; the client app can call /complete separately when ready, or
we can extend this endpoint later to chain the two).
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.supabase_client import supabase
from app.services.push import send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

_ALLOWED_EVENT_TYPES = {
    "en_route",
    "arrived",
    "started",
    "paused",
    "resumed",
    "completed",
    "cancelled_event",
}


class CreateEvent(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=32)
    note: Optional[str] = Field(None, max_length=500)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)


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
