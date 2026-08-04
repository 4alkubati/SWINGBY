from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.supabase_client import supabase
from app.services import escrow

router = APIRouter()


def _can_view_payment(booking: dict, current_user: dict) -> bool:
    """Returns True if the current user is the client or the business owner."""
    if booking["client_id"] == current_user["id"]:
        return True
    if current_user["role"] == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
        if biz.data and biz.data["id"] == booking["business_id"]:
            return True
    return False


@router.get("/mine")
def list_my_payments(current_user: dict = Depends(get_current_user)):
    """F1 (audit 2026-07-01) — list all payments the caller has visibility on.

    Client: payments for bookings they placed.
    Business owner: payments for bookings against their business.
    Returns: {items: [...], total_released, total_pending} for EarningsScreen.
    """
    role = current_user.get("role")
    uid = current_user["id"]

    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if not biz.data:
            return {"items": [], "total_released": 0, "total_pending": 0}
        biz_id = biz.data["id"]
        # payments joined via bookings for this business
        bookings = (
            supabase.table("bookings").select("id").eq("business_id", biz_id).execute()
        )
        booking_ids = [b["id"] for b in (bookings.data or [])]
        if not booking_ids:
            return {"items": [], "total_released": 0, "total_pending": 0}
        pay = (
            supabase.table("payments")
            .select(
                "*, bookings(scheduled_date:confirmed_date, service_category, client_id)"
            )
            .in_("booking_id", booking_ids)
            .order("created_at", desc=True)
            .execute()
        )
    else:
        # client — payments on their bookings
        bookings = (
            supabase.table("bookings").select("id").eq("client_id", uid).execute()
        )
        booking_ids = [b["id"] for b in (bookings.data or [])]
        if not booking_ids:
            return {"items": [], "total_released": 0, "total_pending": 0}
        pay = (
            supabase.table("payments")
            .select("*, bookings(scheduled_date:confirmed_date, service_category)")
            .in_("booking_id", booking_ids)
            .order("created_at", desc=True)
            .execute()
        )

    items = pay.data or []

    # All totals are summed in INTEGER CENTS and converted once at the end.
    # Summing float dollars accumulates binary drift across a business's whole
    # history; the *_cents columns (migration 20260723120000) are authoritative.
    total_released_c = sum(escrow.money_cents(p, "released_to_business") for p in items)
    # fix C: the old filter used bookings.payment_status literals which never
    # matched payments.status, so total_pending was always 0. "Pending" here =
    # money held in escrow, not yet released to the business. Sourced from
    # escrow.HELD_NOT_RELEASED so both status vocabularies live in one place.
    #
    # AUDIT L5 (2026-07-24): the dashboard's "held in escrow" figure was this
    # number, and it counted any row whose STATUS said held — including the
    # accept-time rows that no card had ever been charged for. A merchant was
    # shown "$150 held in escrow" against money nobody had paid, which is a
    # false financial statement, and businesses schedule real trucks against
    # it. Escrow now counts only capture-backed rows; the rest is reported
    # separately as `unverified_pending` so the honest number and the phantom
    # one are both visible instead of silently summed together.
    pending_rows = [p for p in items if p.get("status") in escrow.HELD_NOT_RELEASED]
    total_pending_c = sum(
        escrow.money_cents(p, "escrow_held")
        for p in pending_rows
        if escrow.is_capture_backed(p)
    )
    unverified_pending_c = sum(
        escrow.money_cents(p, "escrow_held")
        for p in pending_rows
        if not escrow.is_capture_backed(p)
    )

    # FINDING C transparency. 24 of 29 production payment rows read
    # 'fully_released' with no Stripe charge behind them — $4,675.50 of payouts
    # nobody ever paid. Those rows are legacy data and are NOT rewritten here,
    # but the reader must stop presenting them as money that moved. `verified`
    # counts only capture-backed rows; the difference is surfaced explicitly so
    # a caller (or an Earnings screen) can show the honest figure instead of
    # silently adding phantom dollars into a headline number.
    #
    # 2026-08-03 (D5): this used `is_capture_backed`, which deliberately
    # excludes 'fully_released' because nothing is HELD once escrow is released.
    # Every legitimately completed and released booking is 'fully_released', so
    # the "verified" figure was **always zero** and the entire history was
    # reported as unverified — the exact inversion of what this field is for.
    # `was_ever_captured` is the historical question ("did money ever arrive"),
    # and it still rejects a released row with no PaymentIntent behind it.
    verified_released_c = sum(
        escrow.money_cents(p, "released_to_business")
        for p in items
        if escrow.was_ever_captured(p)
    )
    unverified_released_c = total_released_c - verified_released_c

    return {
        "items": items,
        "total_released": escrow.to_dollars(total_released_c),
        "total_pending": escrow.to_dollars(total_pending_c),
        # Cents are the authoritative figures; the dollar keys above are kept
        # for the existing mobile/admin readers.
        "total_released_cents": total_released_c,
        "total_pending_cents": total_pending_c,
        # Money a ledger row CLAIMS is held but that no capture stands behind.
        # Never add this into an escrow headline — it is the size of the lie.
        "unverified_pending": escrow.to_dollars(unverified_pending_c),
        "unverified_pending_cents": unverified_pending_c,
        "verified_released": escrow.to_dollars(verified_released_c),
        "verified_released_cents": verified_released_c,
        "unverified_released": escrow.to_dollars(unverified_released_c),
        "unverified_released_cents": unverified_released_c,
    }


@router.get("/{booking_id}")
def get_payment(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Returns the payment record for a given booking."""
    booking_res = (
        supabase.table("bookings")
        .select("client_id, business_id")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not _can_view_payment(booking_res.data, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        payment_res = (
            supabase.table("payments")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        return payment_res.data
    except Exception:
        raise HTTPException(status_code=404, detail="Payment record not found")


class QuoteRequest(BaseModel):
    """What the pay sheet is about to charge for."""

    mode: Literal["hold", "pay"]
    amount: Optional[float] = Field(None, ge=0, le=1_000_000)
    booking_id: Optional[str] = Field(None, max_length=64)
    interest_id: Optional[str] = Field(None, max_length=64)


@router.post("/quote")
def quote_payment(
    data: QuoteRequest,
    current_user: dict = Depends(get_current_user),
):
    """Price a payment BEFORE it is taken — the itemised total for the pay sheet.

    M10. `PaySheet.fetchPayQuote` has called this since it was written; the
    endpoint did not exist. The client caught the 404 and fell back to computing
    the sheet on the device: one un-itemised line, flagged `provisional`.

    That fallback is not wrong today — the number it shows equals what the
    server charges — but it is only accidentally right. The device does not know
    about credits (`credits.redeem_credit_for_booking` is written and gated off
    behind CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED), and the first time anything
    server-side changes the amount, the sheet would confidently show a price we
    do not charge. The number a client sees before paying should come from the
    thing that does the charging.

    THE AMOUNT IS NOT TAKEN FROM THE CLIENT. `amount` in the body is only a
    fallback for a sheet opened before anything is persisted; whenever a booking
    or interest id is given, the price is re-read from that row. A pay sheet
    that quoted whatever the device asked for would be a discount API.
    """
    amount = None

    if data.booking_id:
        res = (
            supabase.table("bookings")
            .select("id, client_id, business_id, total_amount, total_amount_cents")
            .eq("id", data.booking_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Booking not found")
        booking = rows[0]
        if not _can_view_payment(booking, current_user):
            raise HTTPException(status_code=403, detail="Not your booking")
        cents = booking.get("total_amount_cents")
        amount = (
            escrow.to_dollars(int(cents))
            if cents is not None
            else float(booking.get("total_amount") or 0)
        )

    elif data.interest_id:
        res = (
            supabase.table("interests")
            .select("id, quoted_price, service_posts(client_id)")
            .eq("id", data.interest_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Quote not found")
        interest = rows[0]
        post = interest.get("service_posts") or {}
        if post.get("client_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not your quote")
        amount = float(interest.get("quoted_price") or 0)

    elif data.amount is not None:
        # No persisted row yet — a job being posted. Nothing is charged on this
        # path (see the charge-at-post note in api/service_posts.py), so there
        # is nothing to authorise against.
        amount = float(data.amount)

    if amount is None or amount <= 0:
        raise HTTPException(status_code=400, detail="No amount to price")

    total_c = escrow.to_cents(amount)

    # ONE line, deliberately. SwingBy's 10% comes out of the BUSINESS's side —
    # the client pays the quoted price and not a cent more (escrow.PLATFORM_RATE
    # and the cut applied in release_escrow_on_complete). Itemising a "service
    # fee" here would invent a charge the client does not pay.
    # `label_key` not `label`: the server owns the NUMBERS, the device owns the
    # LANGUAGE. Sending display text from here would hand a French or Arabic
    # user an English pay sheet, which is the bug just fixed everywhere else.
    lines = [
        {
            "key": "subtotal",
            "label_key": "pay.jobTotal" if data.mode == "hold" else "pay.quote",
            "value": escrow.to_dollars(total_c),
        }
    ]

    return {
        "mode": data.mode,
        "lines": lines,
        "total": escrow.to_dollars(total_c),
        "total_cents": total_c,
        "currency": "CAD",
        # False is the honest answer while redemption is gated off. When it is
        # turned on, this is where the applied credit shows up as its own line.
        "credit_applied_cents": 0,
        "provisional": False,
    }
