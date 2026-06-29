import logging

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from app.deps import get_current_user
from app.supabase_client import supabase
from app.services.push import send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class MessageSend(BaseModel):
    booking_id: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1, max_length=2000)

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, v):
        v = str(v).strip()
        if not v:
            raise ValueError("Message content cannot be blank")
        return v


# ── Helper ────────────────────────────────────────────────────────────────────

def _assert_message_access(booking: dict, current_user: dict):
    uid = current_user["id"]
    role = current_user["role"]

    if booking["client_id"] == uid:
        return
    if role == "business_owner":
        biz = supabase.table("businesses").select("id").eq("owner_id", uid).single().execute()
        if biz.data and biz.data["id"] == booking["business_id"]:
            return
    if role == "employee":
        emp = supabase.table("employees").select("id").eq("user_id", uid).single().execute()
        if emp.data and emp.data["id"] == booking.get("employee_id"):
            return

    raise HTTPException(status_code=403, detail="You are not a participant in this booking")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/")
def send_message(data: MessageSend, current_user: dict = Depends(get_current_user)):
    booking_res = supabase.table("bookings").select("*").eq("id", data.booking_id).single().execute()
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_res.data
    if booking["status"] not in ("confirmed", "in_progress"):
        raise HTTPException(
            status_code=400,
            detail="Messages are only available on confirmed or in-progress bookings",
        )

    _assert_message_access(booking, current_user)

    try:
        res = supabase.table("messages").insert({
            "booking_id": data.booking_id,
            "sender_id": current_user["id"],
            "content": data.content,
        }).execute()

        # Notify the other participant — best-effort
        try:
            sender_id = current_user["id"]
            # If sender is the client, recipient is the business owner; otherwise recipient is client
            if booking["client_id"] == sender_id:
                # Sender is client → notify business owner
                biz_owner_res = (
                    supabase.table("businesses")
                    .select("owner_id")
                    .eq("id", booking["business_id"])
                    .single()
                    .execute()
                )
                recipient_id = (
                    biz_owner_res.data["owner_id"] if biz_owner_res.data else None
                )
            else:
                # Sender is business side → notify client
                recipient_id = booking["client_id"]

            if recipient_id and recipient_id != sender_id:
                send_push_to_user(
                    recipient_id,
                    "New message",
                    data.content[:100],
                )
        except Exception:
            pass  # push failure must not break the request

        return {"message": "Sent", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not send message")
        raise HTTPException(status_code=400, detail="Could not send message")


@router.get("/unread-count")
def unread_count(current_user: dict = Depends(get_current_user)):
    """
    Lightweight stub for the mobile UnreadProvider's 30-second poll.

    The schema does not yet track per-message read state, so returning zero
    keeps the badge silent rather than fabricating counts. When read receipts
    land, this becomes a real query across the user's bookings.

    Defined BEFORE `/{booking_id}` so FastAPI doesn't try to coerce
    "unread-count" into a UUID and 422 the request.
    """
    return {"total": 0, "by_booking": {}}


@router.get("/{booking_id}")
def get_messages(
    booking_id: str,
    limit: int = Query(50, ge=1, le=200, description="Max messages to return"),
    before: Optional[str] = Query(None, description="ISO-8601 timestamp — return messages sent before this time"),
    current_user: dict = Depends(get_current_user),
):
    booking_res = supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    _assert_message_access(booking_res.data, current_user)

    try:
        query = (
            supabase.table("messages")
            .select("*, users(first_name, last_name)")
            .eq("booking_id", booking_id)
        )
        if before:
            query = query.lt("sent_at", before)

        query = query.order("sent_at", desc=True).limit(limit)
        res = query.execute()
        items = res.data or []
        next_before = items[-1]["sent_at"] if items else None
        return {"items": items, "limit": limit, "before": before, "next_before": next_before}
    except Exception:
        logger.exception("Could not retrieve messages")
        raise HTTPException(status_code=400, detail="Could not retrieve messages")
