"""
me.py — User self-service endpoints (GDPR).

T30  GET  /me/export  — aggregate export of all user data (5/minute)
T79  DELETE /me       — full account erasure (1/hour)

Both endpoints require a valid Bearer token (Depends(get_current_user)).

Ghost UUID used for message anonymisation: 00000000-0000-0000-0000-000000000000
"""

import secrets
import string

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

# GAP-AUDIT-2026-07-18 #4 — referral code alphabet/length.
_REFERRAL_CODE_ALPHABET = string.ascii_uppercase + string.digits
_REFERRAL_CODE_LENGTH = 8


def _generate_referral_code() -> str:
    """
    8-char uppercase alphanumeric code. No idiom for short codes existed
    elsewhere in the codebase (checked uploads.py/request_id.py — both use
    uuid4, too long to show/share). Collision risk at beta scale is
    negligible; docs/referrals_table.sql's partial unique index on
    (code) WHERE referee_id IS NULL is the real backstop.
    """
    return "".join(
        secrets.choice(_REFERRAL_CODE_ALPHABET) for _ in range(_REFERRAL_CODE_LENGTH)
    )


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


@router.get("/referrals")
def get_my_referrals(current_user: dict = Depends(get_current_user)):
    """
    GAP-AUDIT-2026-07-18 #4 — real referral code + real counters. Credit
    APPLICATION is intentionally NOT wired for beta (Kira's call): nothing
    here ever writes a non-zero credit_cents value.

    Response:
      code           — caller's own shareable referral code. Generated and
                       persisted (as a `referrals` row with referee_id=NULL,
                       the "registry" row) the first time this endpoint is
                       called for this user; stable after that.
      invited_count  — number of people who have signed up using this code.
      joined_count   — same as invited_count today: beta has no separate
                       "invited but not yet joined" state to distinguish
                       since claiming the code AT signup IS the join event
                       (see the referral_code handling in auth.signup).
                       Kept as its own field so the mobile contract has
                       somewhere to go once a post-signup completion step
                       exists, without another API change.
      credit_cents   — sum of credit_cents across this user's claim rows.
                       Always 0 today; see docstring above.
    """
    uid = current_user["id"]
    try:
        res = (
            supabase.table("referrals")
            .select("code, referee_id, credit_cents")
            .eq("referrer_id", uid)
            .execute()
        )
        rows = res.data or []
        registry_row = next((r for r in rows if r.get("referee_id") is None), None)
        claim_rows = [r for r in rows if r.get("referee_id") is not None]

        if registry_row:
            code = registry_row["code"]
        else:
            code = _generate_referral_code()
            try:
                supabase.table("referrals").insert(
                    {
                        "code": code,
                        "referrer_id": uid,
                        "referee_id": None,
                        "status": "active",
                        "credit_cents": 0,
                    }
                ).execute()
            except Exception:
                # Best-effort persistence — if this fails (e.g. a race with
                # another concurrent call already inserting the registry
                # row) the caller still gets a usable code back this
                # request; the next call will find the persisted row.
                logger.warning("me.referrals registry insert failed", user_id=uid)

        invited_count = len(claim_rows)
        joined_count = invited_count
        credit_cents = sum(r.get("credit_cents") or 0 for r in claim_rows)

        return {
            "code": code,
            "invited_count": invited_count,
            "joined_count": joined_count,
            "credit_cents": credit_cents,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("me.referrals failed", user_id=uid)
        raise HTTPException(status_code=400, detail="Could not load referral data")


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
