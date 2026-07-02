"""
payments_offplatform.py — D2.3. Client records that a booking was paid outside
SwingBy (cash / e-transfer). Money never touches the platform. No platform cut.
Business subscription is what monetizes this flow.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


class MarkPaidOffPlatform(BaseModel):
    method: str = Field(..., max_length=20)
    note: Optional[str] = Field(None, max_length=500)

    @field_validator("method")
    @classmethod
    def _method(cls, v: str) -> str:
        if v not in ("cash", "e_transfer", "other"):
            raise ValueError("method must be cash, e_transfer, or other")
        return v


@router.post("/{booking_id}/mark-paid-offplatform")
def mark_paid_offplatform(
    booking_id: str,
    data: MarkPaidOffPlatform,
    current_user: dict = Depends(get_current_user),
):
    booking_res = (
        supabase.table("bookings")
        .select("id, client_id, business_id, status, total_amount")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    if booking["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the booking's client can mark it paid")

    if booking["status"] != "completed":
        raise HTTPException(status_code=400, detail="Booking must be completed first")

    existing = (
        supabase.table("payments")
        .select("id, status")
        .eq("booking_id", booking_id)
        .execute()
    )
    for row in existing.data or []:
        if row.get("status") in ("paid_full", "paid_off_platform", "fully_released"):
            raise HTTPException(status_code=400, detail="Booking is already paid")

    total = float(booking.get("total_amount") or 0)
    try:
        pay_res = (
            supabase.table("payments")
            .insert({
                "booking_id": booking_id,
                "total_charged": total,
                "escrow_held": 0,
                "released_to_business": 0,
                "platform_cut": 0,
                "status": "paid_off_platform",
                "method": data.method,
                "notes": (data.note or None),
            })
            .execute()
        )

        supabase.table("bookings").update({"payment_status": "fully_released"}).eq("id", booking_id).execute()

        try:
            supabase.table("booking_events").insert({
                "booking_id": booking_id,
                "event_type": "paid_offplatform",
                "note": f"{data.method}" + (f" — {data.note}" if data.note else ""),
            }).execute()
        except Exception:
            logger.warning("Could not append booking_events for offplatform pay %s", booking_id)

        return {"payment": (pay_res.data or [{}])[0]}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not mark paid off-platform")
        raise HTTPException(status_code=400, detail="Could not mark paid off-platform")
