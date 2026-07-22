"""
me.py — User self-service endpoints (GDPR + account lifecycle).

T30  GET   /me/export   — aggregate export of all user data (5/minute)
T79  DELETE /me          — account deactivation (SOFT delete, 1/hour)
     POST  /me/ghost     — enter in-app ghost mode (hide from discovery)
     POST  /me/unghost   — leave ghost mode

All endpoints require a valid Bearer token (Depends(get_current_user)).

Account deletion is a SOFT delete: `users.deleted_at` is stamped and PII is
scrubbed, but all financial/relational rows (bookings, payments, invoices,
cancellations, reviews, messages) are retained — CRA requires 6-year
retention of financial records. Deletion requires the caller to re-enter
their current password (re-authentication), verified server-side against
Supabase Auth.
"""

import secrets
import string
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.limiter import limiter
from app.supabase_client import supabase, supabase_auth

logger = structlog.get_logger(__name__)

router = APIRouter()

_DELETE_CONFIRM_PHRASE = "DELETE_MY_ACCOUNT"

# Booking states / payment states / dispute states that block entering ghost
# mode. Verified against the live schema (2026-07-21).
_ACTIVE_BOOKING_STATUSES = ("confirmed", "in_progress")
_OUTSTANDING_PAYMENT_STATUSES = ("held", "partial_released")
_OPEN_DISPUTE_STATUSES = ("open", "under_review")

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
    # Re-authentication: the caller must re-enter their current password.
    # True account deletion happens on the website behind this password gate.
    password: str = Field(..., min_length=1, max_length=128)


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


@router.get("/credits")
def get_my_credits(current_user: dict = Depends(get_current_user)):
    """
    The caller's customer-credit balance + full ledger history.

    Credits accrue today only when a business cancels late/no-shows (goodwill —
    see the cancellation ladder). Each history row is a signed cents delta:
    positive = a grant, negative = a redemption against a booking charge.

    Response:
      balance_cents  — current balance in integer cents (SUM of the ledger)
      balance        — same, in dollars (float)
      history        — [{id, amount_cents, reason, booking_id, created_at}], newest first
    """
    uid = current_user["id"]
    try:
        from app.services import credits

        balance_cents = credits.get_balance_cents(uid)
        history = credits.get_history(uid)
        return {
            "balance_cents": balance_cents,
            "balance": round(balance_cents / 100, 2),
            "history": history,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("me.credits failed", user_id=uid)
        raise HTTPException(status_code=400, detail="Could not load credits")


@router.delete("")
@limiter.limit("1/hour")
def delete_my_account(
    request: Request,
    data: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Deactivates the authenticated user's account (SOFT delete).

    Requires: { "confirm": "DELETE_MY_ACCOUNT", "password": "<current password>" }

    Behaviour:
      * The current password is re-verified server-side against Supabase Auth.
      * `users.deleted_at` is stamped and PII is scrubbed (name -> generic,
        email -> non-reversible tombstone that frees the original address,
        phone/avatar -> null).
      * ALL financial/relational rows survive (bookings, payments, invoices,
        cancellations, reviews, messages, businesses) — CRA 6-year retention.
      * The soft-deleted user is locked out on the next request (get_current_user
        rejects deleted_at). Existing sessions are also revoked best-effort.

    This does NOT hard-delete the Supabase auth user (no cascade), does NOT
    delete businesses/messages/reviews/bookings/payments.
    """
    if data.confirm != _DELETE_CONFIRM_PHRASE:
        raise HTTPException(
            status_code=400,
            detail="Confirmation phrase does not match — send 'DELETE_MY_ACCOUNT'",
        )

    uid = current_user["id"]
    email = current_user.get("email")
    if not email:
        # No email on file to re-authenticate against — refuse rather than
        # proceed unauthenticated.
        raise HTTPException(
            status_code=400, detail="Account has no email to re-authenticate"
        )

    # --- Re-authentication: verify the current password server-side. --------
    # supabase_auth is the dedicated session-creating client (see
    # supabase_client.py). Verifying the password = a successful sign-in.
    try:
        auth_check = supabase_auth.auth.sign_in_with_password(
            {"email": email, "password": data.password}
        )
        password_ok = bool(auth_check and auth_check.session)
    except Exception:
        password_ok = False

    if not password_ok:
        raise HTTPException(status_code=401, detail="Password re-authentication failed")

    try:
        # Non-reversible tombstone: contains only the uid (not the original
        # address), so the original email frees up for a fresh signup and the
        # tombstone can't be reversed back to the person.
        tombstone_email = f"deleted+{uid}@deleted.swingby.invalid"

        # 1. Soft delete + PII scrub on our users row. Financial/relational
        #    rows are intentionally left intact.
        supabase.table("users").update(
            {
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "first_name": "Deleted",
                "last_name": "User",
                "email": tombstone_email,
                "phone": None,
                "avatar_url": None,
                "is_ghosted": False,
            }
        ).eq("id", uid).execute()

        # 2. Best-effort: free the address at the auth layer too and revoke
        #    sessions. Neither is required for lock-out (deleted_at handles
        #    that) so failures must not roll back the soft delete.
        try:
            supabase.auth.admin.update_user_by_id(uid, {"email": tombstone_email})
        except Exception:
            logger.warning("me.delete_account auth email scrub failed", user_id=uid)
        try:
            supabase.auth.admin.sign_out(uid)
        except Exception:
            logger.warning("me.delete_account sign_out failed", user_id=uid)

        logger.info("me.delete_account (soft)", user_id=uid)
        return {"message": "account_deactivated"}

    except HTTPException:
        raise
    except Exception:
        logger.exception("me.delete_account failed", user_id=uid)
        raise HTTPException(status_code=400, detail="Could not deactivate account")


# ---------------------------------------------------------------------------
# Ghost mode (in-app self-service; distinct from admin suspension & deletion)
# ---------------------------------------------------------------------------


def _ghost_blockers(uid: str, role: str | None) -> list[str]:
    """
    Return a list of human-readable reasons the user cannot enter ghost mode.
    Empty list => clear to ghost.

    Blocks on:
      * an active booking (status in confirmed/in_progress) where the user is
        the client OR owns the business,
      * outstanding money (bookings.payment_status in held/partial_released),
      * an open dispute (status open/under_review) filed by OR against them.
    """
    reasons: list[str] = []

    # Businesses this user owns (for the business-side of every check).
    biz_ids: list[str] = []
    if role == "business_owner":
        try:
            biz_res = (
                supabase.table("businesses").select("id").eq("owner_id", uid).execute()
            )
            biz_ids = [b["id"] for b in (biz_res.data or [])]
        except Exception:
            logger.warning("ghost blocker business lookup failed", user_id=uid)

    # Gather bookings where the user is a party (client or business owner).
    bookings: dict[str, dict] = {}
    try:
        as_client = (
            supabase.table("bookings")
            .select("id, status, payment_status")
            .eq("client_id", uid)
            .execute()
        )
        for b in as_client.data or []:
            bookings[b["id"]] = b
    except Exception:
        logger.warning("ghost blocker client-booking lookup failed", user_id=uid)
    if biz_ids:
        try:
            as_biz = (
                supabase.table("bookings")
                .select("id, status, payment_status")
                .in_("business_id", biz_ids)
                .execute()
            )
            for b in as_biz.data or []:
                bookings[b["id"]] = b
        except Exception:
            logger.warning("ghost blocker biz-booking lookup failed", user_id=uid)

    active = sum(
        1 for b in bookings.values() if b.get("status") in _ACTIVE_BOOKING_STATUSES
    )
    if active:
        reasons.append(f"{active} active booking(s) must be completed or cancelled")

    outstanding = sum(
        1
        for b in bookings.values()
        if b.get("payment_status") in _OUTSTANDING_PAYMENT_STATUSES
    )
    if outstanding:
        reasons.append(f"{outstanding} booking(s) with money still in escrow")

    # Open disputes: filed by the user, or on any booking they are a party to.
    dispute_ids: set[str] = set()
    try:
        filed = (
            supabase.table("disputes")
            .select("id, status")
            .eq("opened_by", uid)
            .in_("status", list(_OPEN_DISPUTE_STATUSES))
            .execute()
        )
        for d in filed.data or []:
            dispute_ids.add(d["id"])
    except Exception:
        logger.warning("ghost blocker filed-dispute lookup failed", user_id=uid)
    if bookings:
        try:
            against = (
                supabase.table("disputes")
                .select("id, status")
                .in_("booking_id", list(bookings.keys()))
                .in_("status", list(_OPEN_DISPUTE_STATUSES))
                .execute()
            )
            for d in against.data or []:
                dispute_ids.add(d["id"])
        except Exception:
            logger.warning("ghost blocker booking-dispute lookup failed", user_id=uid)
    if dispute_ids:
        reasons.append(f"{len(dispute_ids)} open dispute(s) must be resolved first")

    return reasons


@router.post("/ghost")
def enter_ghost_mode(current_user: dict = Depends(get_current_user)):
    """
    Enter in-app ghost mode: the user is hidden from discovery and becomes
    unbookable. A business owner's business disappears from geo-browse and the
    owner can no longer express interest on posts; a client's open service
    posts disappear from the business-facing feed. Existing bookings and
    message threads keep working. Ghost mode lifts automatically on next login.

    Blocked (409) while the user has an active booking, money still in escrow,
    or an open dispute.
    """
    uid = current_user["id"]
    reasons = _ghost_blockers(uid, current_user.get("role"))
    if reasons:
        raise HTTPException(
            status_code=409,
            detail={"error": "cannot_enter_ghost_mode", "reasons": reasons},
        )

    try:
        supabase.table("users").update({"is_ghosted": True}).eq("id", uid).execute()
    except Exception:
        logger.exception("me.enter_ghost_mode failed", user_id=uid)
        raise HTTPException(status_code=400, detail="Could not enter ghost mode")

    logger.info("me.enter_ghost_mode", user_id=uid)
    return {"message": "ghost_mode_on", "is_ghosted": True}


@router.post("/unghost")
def leave_ghost_mode(current_user: dict = Depends(get_current_user)):
    """Leave ghost mode. (Login also clears the flag automatically.)"""
    uid = current_user["id"]
    try:
        supabase.table("users").update({"is_ghosted": False}).eq("id", uid).execute()
    except Exception:
        logger.exception("me.leave_ghost_mode failed", user_id=uid)
        raise HTTPException(status_code=400, detail="Could not leave ghost mode")

    logger.info("me.leave_ghost_mode", user_id=uid)
    return {"message": "ghost_mode_off", "is_ghosted": False}
