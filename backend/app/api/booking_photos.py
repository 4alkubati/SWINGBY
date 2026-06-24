"""
booking_photos.py — Before/After proof-of-work attachments.

A booking_photos row links an uploaded image (already in Supabase Storage via
/uploads/image) to a booking, tagged as 'before' or 'after'. The provider
captures a before-photo when starting and an after-photo when completing; the
client sees both on BookingDetails as dispute defense.

Endpoints
---------
POST   /bookings/{booking_id}/photos   attach a photo (provider-side)
GET    /bookings/{booking_id}/photos   list photos (any party)

Authorisation
-------------
- Create: business_owner (of the booking's business) OR assigned employee.
- Read:   client, business owner, OR assigned employee.

The actual file upload happens at /uploads/image; this endpoint just records
the (url, path, phase) tuple against the booking.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


_ALLOWED_PHASES = {"before", "after"}


class AttachPhoto(BaseModel):
    phase: str = Field(..., min_length=1, max_length=16)
    url: str = Field(..., min_length=1, max_length=2048)
    path: str = Field(..., min_length=1, max_length=512)
    caption: Optional[str] = Field(None, max_length=500)


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


@router.post("/{booking_id}/photos")
def attach_photo(
    booking_id: str,
    data: AttachPhoto,
    current_user: dict = Depends(get_current_user),
):
    if data.phase not in _ALLOWED_PHASES:
        raise HTTPException(
            status_code=400,
            detail=f"phase must be one of: {sorted(_ALLOWED_PHASES)}",
        )

    booking = _load_booking(booking_id)

    if not _is_provider(booking, current_user):
        raise HTTPException(
            status_code=403,
            detail="Only the assigned business owner or employee can attach photos",
        )

    payload = {
        "booking_id": booking_id,
        "uploaded_by": current_user["id"],
        "phase": data.phase,
        "url": data.url,
        "path": data.path,
        "caption": data.caption,
    }

    try:
        res = supabase.table("booking_photos").insert(payload).execute()
        return res.data[0] if res.data else payload
    except Exception:
        logger.exception("Could not insert booking_photo for booking %s", booking_id)
        raise HTTPException(status_code=400, detail="Could not attach photo")


@router.get("/{booking_id}/photos")
def list_photos(
    booking_id: str,
    phase: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    if phase is not None and phase not in _ALLOWED_PHASES:
        raise HTTPException(
            status_code=400,
            detail=f"phase must be one of: {sorted(_ALLOWED_PHASES)} (or omitted)",
        )

    booking = _load_booking(booking_id)

    if not _is_party(booking, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        q = (
            supabase.table("booking_photos")
            .select("*")
            .eq("booking_id", booking_id)
        )
        if phase:
            q = q.eq("phase", phase)
        res = q.order("created_at", desc=False).limit(limit).execute()
        return {"items": res.data or [], "booking_id": booking_id}
    except Exception:
        logger.exception("Could not list booking_photos for %s", booking_id)
        raise HTTPException(status_code=400, detail="Could not list photos")
