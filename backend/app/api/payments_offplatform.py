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

    # Access: the booking's client OR the business owner may record an
    # off-platform payment. The product owner wants the BUSINESS side working for
    # beta (they collect the cash / e-transfer and mark it paid).
    allowed = booking["client_id"] == current_user["id"]
    if not allowed and current_user.get("role") == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
        allowed = bool(biz.data) and biz.data["id"] == booking["business_id"]
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Only the booking's client or business can mark it paid",
        )

    # Lifecycle: off-platform payment is recorded on a LIVE booking (before or at
    # completion). A cancelled booking can't be paid. (The old guard required
    # status=='completed', but /complete already releases the payment row, so the
    # 'already paid' check below made this endpoint unsatisfiable — fix B.)
    if booking["status"] == "cancelled":
        raise HTTPException(
            status_code=400, detail="Cannot mark a cancelled booking as paid"
        )

    # Exactly one payments row per booking (accept inserts it; the rest of the
    # codebase reads it with .single()). UPDATE it in place — inserting a second
    # row here was fix B's duplicate-row bug that broke every .single() reader.
    existing = (
        supabase.table("payments")
        .select("id, status")
        .eq("booking_id", booking_id)
        .execute()
    )
    rows = existing.data or []
    for row in rows:
        if row.get("status") in ("paid_off_platform", "fully_released", "refunded"):
            raise HTTPException(status_code=400, detail="Booking is already settled")

    total = float(booking.get("total_amount") or 0)
    # Off-platform: money never touches the platform → no escrow, no platform cut.
    offplatform_fields = {
        "total_charged": total,
        "escrow_held": 0,
        "released_to_business": 0,
        "platform_cut": 0,
        "status": "paid_off_platform",
        "method": data.method,
    }
    try:
        if rows:
            pay_res = (
                supabase.table("payments")
                .update(offplatform_fields)
                .eq("id", rows[0]["id"])
                .execute()
            )
        else:
            # Fallback: booking has no payment row (e.g. a direct geo-browse
            # booking created outside the accept flow). Create the single row.
            pay_res = (
                supabase.table("payments")
                .insert({"booking_id": booking_id, **offplatform_fields})
                .execute()
            )

        supabase.table("bookings").update({"payment_status": "fully_released"}).eq(
            "id", booking_id
        ).execute()

        try:
            supabase.table("booking_events").insert(
                {
                    "booking_id": booking_id,
                    "actor_id": current_user["id"],
                    "event_type": "paid_offplatform",
                    "note": f"{data.method}" + (f" — {data.note}" if data.note else ""),
                }
            ).execute()
        except Exception:
            logger.warning(
                "Could not append booking_events for offplatform pay %s", booking_id
            )

        return {"payment": (pay_res.data or [{}])[0]}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not mark paid off-platform")
        raise HTTPException(status_code=400, detail="Could not mark paid off-platform")
