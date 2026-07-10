import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from app.deps import get_current_user
from app.supabase_client import supabase
from app.services.push import send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class MessageSend(BaseModel):
    # A message belongs to exactly one thread: a confirmed booking OR a quote
    # (interest) — pre-booking negotiation happens on the interest thread.
    booking_id: Optional[str] = Field(None, min_length=1, max_length=500)
    interest_id: Optional[str] = Field(None, min_length=1, max_length=500)
    content: str = Field(..., min_length=1, max_length=2000)

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, v):
        v = str(v).strip()
        if not v:
            raise ValueError("Message content cannot be blank")
        return v

    @model_validator(mode="after")
    def one_thread_only(self):
        if bool(self.booking_id) == bool(self.interest_id):
            raise ValueError("Provide exactly one of booking_id or interest_id")
        return self


# ── Helpers ───────────────────────────────────────────────────────────────────


def _my_business_id(uid: str) -> Optional[str]:
    res = (
        supabase.table("businesses").select("id").eq("owner_id", uid).limit(1).execute()
    )
    return res.data[0]["id"] if res.data else None


def _assert_message_access(booking: dict, current_user: dict):
    uid = current_user["id"]
    role = current_user["role"]

    if booking["client_id"] == uid:
        return
    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if biz.data and biz.data["id"] == booking["business_id"]:
            return
    if role == "employee":
        emp = (
            supabase.table("employees")
            .select("id")
            .eq("user_id", uid)
            .single()
            .execute()
        )
        if emp.data and emp.data["id"] == booking.get("employee_id"):
            return

    raise HTTPException(
        status_code=403, detail="You are not a participant in this booking"
    )


def _get_interest_thread(interest_id: str) -> dict:
    """Interest + its post; 404 if either is missing."""
    res = (
        supabase.table("interests")
        .select("*, service_posts(id, title, status, client_id)")
        .eq("id", interest_id)
        .single()
        .execute()
    )
    if not res.data or not res.data.get("service_posts"):
        raise HTTPException(status_code=404, detail="Quote thread not found")
    return res.data


def _assert_interest_access(interest: dict, current_user: dict):
    """Participants: the post's client, or the quoting business's owner."""
    uid = current_user["id"]
    if interest["service_posts"]["client_id"] == uid:
        return
    if current_user["role"] in ("business_owner", "employee"):
        biz_id = _my_business_id(uid)
        if biz_id and biz_id == interest["business_id"]:
            return
        if current_user["role"] == "employee":
            emp = (
                supabase.table("employees")
                .select("business_id")
                .eq("user_id", uid)
                .single()
                .execute()
            )
            if emp.data and emp.data["business_id"] == interest["business_id"]:
                return
    raise HTTPException(
        status_code=403, detail="You are not a participant in this conversation"
    )


def _mark_read(thread_field: str, thread_id: str, uid: str):
    """Mark everything in the thread not sent by the reader as read."""
    try:
        (
            supabase.table("messages")
            .update({"read_at": datetime.now(timezone.utc).isoformat()})
            .eq(thread_field, thread_id)
            .neq("sender_id", uid)
            .is_("read_at", "null")
            .execute()
        )
    except Exception:
        pass  # read receipts are best-effort


def _accessible_thread_ids(current_user: dict):
    """(booking_ids, interest_ids, context) the user participates in."""
    uid = current_user["id"]
    role = current_user["role"]
    booking_rows, interest_rows = [], []

    if role == "client":
        booking_rows = (
            supabase.table("bookings")
            .select("id, status, business_id, businesses(business_name)")
            .eq("client_id", uid)
            .execute()
        ).data or []
        interest_rows = (
            supabase.table("interests")
            .select(
                "id, status, quoted_price, business_id, "
                "service_posts!inner(id, title, status, client_id), "
                "businesses(business_name)"
            )
            .eq("service_posts.client_id", uid)
            .execute()
        ).data or []
    elif role in ("business_owner", "employee"):
        biz_id = _my_business_id(uid)
        if not biz_id and role == "employee":
            emp = (
                supabase.table("employees")
                .select("business_id")
                .eq("user_id", uid)
                .single()
                .execute()
            )
            biz_id = emp.data["business_id"] if emp.data else None
        if biz_id:
            booking_rows = (
                supabase.table("bookings")
                .select("id, status, client_id, users(first_name, last_name, avatar_url)")
                .eq("business_id", biz_id)
                .execute()
            ).data or []
            interest_rows = (
                supabase.table("interests")
                .select(
                    "id, status, quoted_price, business_id, "
                    "service_posts(id, title, status, client_id, "
                    "users(first_name, last_name, avatar_url))"
                )
                .eq("business_id", biz_id)
                .execute()
            ).data or []

    return booking_rows, interest_rows


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/")
def send_message(data: MessageSend, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    recipient_id = None

    if data.booking_id:
        booking_res = (
            supabase.table("bookings")
            .select("*")
            .eq("id", data.booking_id)
            .single()
            .execute()
        )
        if not booking_res.data:
            raise HTTPException(status_code=404, detail="Booking not found")

        booking = booking_res.data
        if booking["status"] not in ("confirmed", "in_progress"):
            raise HTTPException(
                status_code=400,
                detail="Messages are only available on confirmed or in-progress bookings",
            )
        _assert_message_access(booking, current_user)

        if booking["client_id"] == uid:
            biz_owner_res = (
                supabase.table("businesses")
                .select("owner_id")
                .eq("id", booking["business_id"])
                .single()
                .execute()
            )
            recipient_id = biz_owner_res.data["owner_id"] if biz_owner_res.data else None
        else:
            recipient_id = booking["client_id"]

        row = {"booking_id": data.booking_id, "sender_id": uid, "content": data.content}
    else:
        interest = _get_interest_thread(data.interest_id)
        _assert_interest_access(interest, current_user)

        # Thread stays open while the post is negotiable (open) or already
        # matched via this interest; closed/expired posts end the conversation.
        post_status = interest["service_posts"]["status"]
        if post_status not in ("open", "matched") and interest["status"] != "accepted":
            raise HTTPException(
                status_code=400, detail="This job post is no longer open for messages"
            )

        client_id = interest["service_posts"]["client_id"]
        if client_id == uid:
            biz_owner_res = (
                supabase.table("businesses")
                .select("owner_id")
                .eq("id", interest["business_id"])
                .single()
                .execute()
            )
            recipient_id = biz_owner_res.data["owner_id"] if biz_owner_res.data else None
        else:
            recipient_id = client_id

        row = {"interest_id": data.interest_id, "sender_id": uid, "content": data.content}

    try:
        res = supabase.table("messages").insert(row).execute()

        # Notify the other participant — best-effort
        try:
            if recipient_id and recipient_id != uid:
                send_push_to_user(recipient_id, "New message", data.content[:100])
        except Exception:
            pass  # push failure must not break the request

        return {"message": "Sent", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not send message")
        raise HTTPException(status_code=400, detail="Could not send message")


@router.get("/threads")
def list_threads(current_user: dict = Depends(get_current_user)):
    """
    Unified inbox: one row per booking thread and per quote (interest) thread.

    Booking threads appear for confirmed / in-progress / completed bookings even
    with no messages yet. Interest threads appear once they carry at least one
    message (quoting without a note doesn't clutter the inbox).
    """
    uid = current_user["id"]
    try:
        booking_rows, interest_rows = _accessible_thread_ids(current_user)

        booking_ids = [b["id"] for b in booking_rows]
        interest_ids = [i["id"] for i in interest_rows]

        msgs = []
        if booking_ids or interest_ids:
            q = supabase.table("messages").select(
                "id, booking_id, interest_id, sender_id, content, sent_at, read_at"
            )
            if booking_ids and interest_ids:
                q = q.or_(
                    f"booking_id.in.({','.join(booking_ids)}),"
                    f"interest_id.in.({','.join(interest_ids)})"
                )
            elif booking_ids:
                q = q.in_("booking_id", booking_ids)
            else:
                q = q.in_("interest_id", interest_ids)
            msgs = (q.order("sent_at", desc=True).limit(1000).execute()).data or []

        by_booking: dict = {}
        by_interest: dict = {}
        for m in msgs:
            key = m.get("booking_id") or m.get("interest_id")
            bucket = by_booking if m.get("booking_id") else by_interest
            agg = bucket.setdefault(key, {"last": m, "unread": 0})
            if m["sender_id"] != uid and not m.get("read_at"):
                agg["unread"] += 1

        threads = []

        for b in booking_rows:
            if b.get("status") not in ("confirmed", "in_progress", "completed"):
                continue
            agg = by_booking.get(b["id"], {"last": None, "unread": 0})
            client_user = b.get("users") or {}
            client_name = " ".join(
                filter(None, [client_user.get("first_name"), client_user.get("last_name")])
            )
            counterpart = (
                (b.get("businesses") or {}).get("business_name") or client_name or "Chat"
            )
            threads.append(
                {
                    "thread_type": "booking",
                    "id": b["id"],
                    "title": counterpart,
                    "counterpart_name": counterpart,
                    "counterpart_avatar": client_user.get("avatar_url"),
                    "status": b.get("status"),
                    "last_message": (agg["last"] or {}).get("content"),
                    "last_at": (agg["last"] or {}).get("sent_at"),
                    "unread_count": agg["unread"],
                }
            )

        for i in interest_rows:
            agg = by_interest.get(i["id"])
            if not agg:
                continue  # no conversation yet
            post = i.get("service_posts") or {}
            client_user = post.get("users") or {}
            counterpart = (
                (i.get("businesses") or {}).get("business_name")
                or " ".join(
                    filter(None, [client_user.get("first_name"), client_user.get("last_name")])
                )
                or "Chat"
            )
            threads.append(
                {
                    "thread_type": "interest",
                    "id": i["id"],
                    "title": post.get("title") or "Job post",
                    "counterpart_name": counterpart,
                    "counterpart_avatar": client_user.get("avatar_url"),
                    "status": i.get("status"),
                    "quoted_price": i.get("quoted_price"),
                    "last_message": (agg["last"] or {}).get("content"),
                    "last_at": (agg["last"] or {}).get("sent_at"),
                    "unread_count": agg["unread"],
                }
            )

        threads.sort(key=lambda t: t.get("last_at") or "", reverse=True)
        return {"items": threads}
    except Exception:
        logger.exception("Could not list threads")
        raise HTTPException(status_code=400, detail="Could not list threads")


@router.get("/unread-count")
def unread_count(current_user: dict = Depends(get_current_user)):
    """Total unread messages across all of the user's threads (30s mobile poll)."""
    uid = current_user["id"]
    try:
        booking_rows, interest_rows = _accessible_thread_ids(current_user)
        booking_ids = [b["id"] for b in booking_rows]
        interest_ids = [i["id"] for i in interest_rows]
        if not booking_ids and not interest_ids:
            return {"total": 0, "by_booking": {}}

        q = supabase.table("messages").select(
            "id, booking_id, interest_id", count="exact"
        ).neq("sender_id", uid).is_("read_at", "null")
        if booking_ids and interest_ids:
            q = q.or_(
                f"booking_id.in.({','.join(booking_ids)}),"
                f"interest_id.in.({','.join(interest_ids)})"
            )
        elif booking_ids:
            q = q.in_("booking_id", booking_ids)
        else:
            q = q.in_("interest_id", interest_ids)
        res = q.execute()
        rows = res.data or []
        by_booking: dict = {}
        for r in rows:
            if r.get("booking_id"):
                by_booking[r["booking_id"]] = by_booking.get(r["booking_id"], 0) + 1
        return {"total": len(rows), "by_booking": by_booking}
    except Exception:
        logger.exception("Could not compute unread count")
        return {"total": 0, "by_booking": {}}


@router.get("/interest/{interest_id}")
def get_interest_messages(
    interest_id: str,
    limit: int = Query(50, ge=1, le=200, description="Max messages to return"),
    before: Optional[str] = Query(
        None, description="ISO-8601 timestamp — return messages sent before this time"
    ),
    current_user: dict = Depends(get_current_user),
):
    interest = _get_interest_thread(interest_id)
    _assert_interest_access(interest, current_user)

    try:
        query = (
            supabase.table("messages")
            .select("*, users(first_name, last_name)")
            .eq("interest_id", interest_id)
        )
        if before:
            query = query.lt("sent_at", before)

        query = query.order("sent_at", desc=True).limit(limit)
        res = query.execute()
        items = res.data or []
        _mark_read("interest_id", interest_id, current_user["id"])
        next_before = items[-1]["sent_at"] if items else None
        return {
            "items": items,
            "limit": limit,
            "before": before,
            "next_before": next_before,
            "interest": {
                "id": interest["id"],
                "status": interest["status"],
                "quoted_price": interest.get("quoted_price"),
                "post_title": interest["service_posts"].get("title"),
                "post_status": interest["service_posts"].get("status"),
            },
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not retrieve messages")
        raise HTTPException(status_code=400, detail="Could not retrieve messages")


@router.get("/{booking_id}")
def get_messages(
    booking_id: str,
    limit: int = Query(50, ge=1, le=200, description="Max messages to return"),
    before: Optional[str] = Query(
        None, description="ISO-8601 timestamp — return messages sent before this time"
    ),
    current_user: dict = Depends(get_current_user),
):
    booking_res = (
        supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    )
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
        _mark_read("booking_id", booking_id, current_user["id"])
        next_before = items[-1]["sent_at"] if items else None
        return {
            "items": items,
            "limit": limit,
            "before": before,
            "next_before": next_before,
        }
    except Exception:
        logger.exception("Could not retrieve messages")
        raise HTTPException(status_code=400, detail="Could not retrieve messages")
