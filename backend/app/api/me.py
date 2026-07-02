"""
me.py — User self-service endpoints (GDPR).

T30  GET  /me/export  — aggregate export of all user data (5/minute)
T79  DELETE /me       — full account erasure (1/hour)

Both endpoints require a valid Bearer token (Depends(get_current_user)).

Ghost UUID used for message anonymisation: 00000000-0000-0000-0000-000000000000
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.limiter import limiter
from app.supabase_client import supabase

logger = structlog.get_logger(__name__)

router = APIRouter()

_GHOST_UUID = "00000000-0000-0000-0000-000000000000"
_DELETE_CONFIRM_PHRASE = "DELETE_MY_ACCOUNT"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class DeleteAccountRequest(BaseModel):
    confirm: str = Field(..., max_length=50)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/export")
@limiter.limit("5/minute")
def export_my_data(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Aggregates all personal data for the authenticated user and returns it
    as a single JSON object (GDPR data-export / right of access).
    """
    uid = current_user["id"]

    try:
        # Users row (already fetched by get_current_user, but re-fetch for completeness)
        user_row = supabase.table("users").select("*").eq("id", uid).single().execute()
        user_data = user_row.data or {}

        # Businesses owned by this user
        biz_res = supabase.table("businesses").select("*").eq("owner_id", uid).execute()
        businesses = biz_res.data or []
        biz_ids = [b["id"] for b in businesses]

        # Service posts where client_id = me
        sp_res = (
            supabase.table("service_posts").select("*").eq("client_id", uid).execute()
        )
        service_posts = sp_res.data or []

        # Interests where business_id IN my businesses
        interests: list = []
        if biz_ids:
            int_res = (
                supabase.table("interests")
                .select("*")
                .in_("business_id", biz_ids)
                .execute()
            )
            interests = int_res.data or []

        # Bookings where client_id = me
        bookings_client_res = (
            supabase.table("bookings").select("*").eq("client_id", uid).execute()
        )
        bookings_client = bookings_client_res.data or []

        # Bookings where business_id IN my businesses
        bookings_biz: list = []
        if biz_ids:
            bb_res = (
                supabase.table("bookings")
                .select("*")
                .in_("business_id", biz_ids)
                .execute()
            )
            bookings_biz = bb_res.data or []

        # Merge bookings deduplicating by id
        seen_ids: set = set()
        bookings: list = []
        for b in bookings_client + bookings_biz:
            if b["id"] not in seen_ids:
                seen_ids.add(b["id"])
                bookings.append(b)

        # Messages sent by me
        msg_res = supabase.table("messages").select("*").eq("sender_id", uid).execute()
        messages = msg_res.data or []

        # Reviews written by me
        rev_res = supabase.table("reviews").select("*").eq("reviewer_id", uid).execute()
        reviews = rev_res.data or []

        logger.info("me.export", user_id=uid)

        return {
            "user": user_data,
            "businesses": businesses,
            "service_posts": service_posts,
            "interests": interests,
            "bookings": bookings,
            "messages": messages,
            "reviews": reviews,
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("me.export failed", user_id=uid)
        raise HTTPException(status_code=400, detail="Could not export data")


@router.delete("")
@limiter.limit("1/hour")
def delete_my_account(
    request: Request,
    data: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Permanently erases the authenticated user's account and all associated
    data (GDPR right of erasure).

    The request body must contain: { "confirm": "DELETE_MY_ACCOUNT" }
    """
    if data.confirm != _DELETE_CONFIRM_PHRASE:
        raise HTTPException(
            status_code=400,
            detail="Confirmation phrase does not match — send 'DELETE_MY_ACCOUNT'",
        )

    uid = current_user["id"]

    try:
        # 1. Collect owned business IDs for cascade operations
        biz_res = (
            supabase.table("businesses").select("id").eq("owner_id", uid).execute()
        )
        biz_ids = [b["id"] for b in (biz_res.data or [])]

        # 2. Delete interests referencing owned businesses (if FK not cascading)
        if biz_ids:
            supabase.table("interests").delete().in_("business_id", biz_ids).execute()

        # 3. Delete service_posts for this user (cascades interests via FK if set)
        supabase.table("service_posts").delete().eq("client_id", uid).execute()

        # 4. Delete bookings where client or business owner
        supabase.table("bookings").delete().eq("client_id", uid).execute()
        if biz_ids:
            supabase.table("bookings").delete().in_("business_id", biz_ids).execute()

        # 5. Delete owned businesses
        if biz_ids:
            supabase.table("businesses").delete().eq("owner_id", uid).execute()

        # 6. Anonymise sent messages — preserve thread integrity for the other party
        supabase.table("messages").update(
            {"sender_id": _GHOST_UUID, "content": "[deleted]"}
        ).eq("sender_id", uid).execute()

        # 7. Delete reviews written by this user
        supabase.table("reviews").delete().eq("reviewer_id", uid).execute()

        # 8. Delete push tokens
        supabase.table("push_tokens").delete().eq("user_id", uid).execute()

        # 9. Delete auth.users row via admin API (last step — point of no return)
        supabase.auth.admin.delete_user(uid)

        logger.info("me.delete_account", user_id=uid)
        return {"message": "account_deleted"}

    except HTTPException:
        raise
    except Exception:
        logger.exception("me.delete_account failed", user_id=uid)
        raise HTTPException(status_code=400, detail="Could not delete account")
