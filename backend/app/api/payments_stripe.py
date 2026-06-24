"""
payments_stripe.py — Stripe sandbox Checkout endpoints.

Endpoints
---------
POST /payments/stripe/checkout/{booking_id}
    Auth: the client who owns the booking.
    Creates a Stripe Checkout Session for the booking's total_amount and
    returns its URL. Mobile opens this with Linking.openURL.

POST /payments/stripe/webhook
    No auth header — Stripe signs the body. We verify with STRIPE_WEBHOOK_SECRET.
    Handles `checkout.session.completed`: marks the booking's payment row as
    fully paid (Stripe sandbox simulates the cash side; on-platform escrow
    accounting already split via /interests accept). Other event types ack.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.deps import get_current_user
from app.supabase_client import supabase
from app.services import stripe_service

logger = logging.getLogger(__name__)

router = APIRouter()


class CheckoutResponse(BaseModel):
    session_id: str
    url: str


@router.post("/checkout/{booking_id}", response_model=CheckoutResponse)
def create_checkout(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    booking_res = (
        supabase.table("bookings")
        .select("id, client_id, total_amount, service_category, status")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    if booking["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the booking's client can pay")

    if booking["status"] in ("cancelled",):
        raise HTTPException(status_code=400, detail="Booking is cancelled")

    amount = float(booking.get("total_amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Booking total_amount must be > 0")

    email: Optional[str] = current_user.get("email")
    description = f"SwingBy — {booking.get('service_category') or 'booking'} #{booking_id[:8]}"

    session = stripe_service.create_checkout_session(
        booking_id=booking_id,
        amount_cad=amount,
        description=description,
        client_email=email,
    )
    return CheckoutResponse(session_id=session["id"], url=session["url"])


@router.post("/webhook")
async def webhook(request: Request):
    payload_bytes = await request.body()
    sig_header = request.headers.get("stripe-signature")

    event = stripe_service.verify_webhook(payload_bytes, sig_header)

    # stripe.Webhook.construct_event returns a stripe.Event (StripeObject),
    # which is NOT a dict but DOES support [] subscript and dict-style .get on
    # nested fields. Use try/except so we handle both the real Stripe shape and
    # a plain dict (used by tests). isinstance(event, dict) was False in prod,
    # so the previous version silently dropped every completed event.
    try:
        etype = event["type"]
    except (KeyError, TypeError):
        etype = getattr(event, "type", None)

    try:
        data_object = event["data"]["object"]
    except (KeyError, TypeError):
        data_object = None

    if etype == "checkout.session.completed" and data_object is not None:
        metadata = {}
        try:
            metadata = data_object["metadata"] or {}
        except (KeyError, TypeError):
            metadata = getattr(data_object, "metadata", {}) or {}
        booking_id = metadata.get("booking_id") if hasattr(metadata, "get") else None
        session_id = None
        try:
            session_id = data_object["id"]
        except (KeyError, TypeError):
            session_id = getattr(data_object, "id", None)
        if booking_id:
            _mark_payment_paid(booking_id, session_id)
        else:
            logger.warning("checkout.session.completed missing booking_id metadata")
    else:
        # Other events (charge.refunded, etc.) — log for visibility; no DB writes yet.
        logger.info("Stripe webhook event ignored: %s", etype)

    return {"received": True, "type": etype}


def _mark_payment_paid(booking_id: str, stripe_session_id: str | None) -> None:
    """
    On `checkout.session.completed`, finalize the on-platform accounting.

    The /interests accept flow already inserted a payments row with
    status='partial' (50% released, 50% escrow). Beta semantics: in sandbox the
    full charge cleared, so mark the row 'paid_full' and stamp the Stripe
    session id in `notes` for traceability. The release-on-complete path in
    /bookings/{id}/complete continues to handle the remaining 50% + platform
    cut at job-complete time.
    """
    update: dict = {"status": "paid_full"}
    if stripe_session_id:
        update["notes"] = f"stripe_session={stripe_session_id}"
    try:
        supabase.table("payments").update(update).eq("booking_id", booking_id).execute()
    except Exception:
        logger.exception("Could not mark payment paid for booking %s", booking_id)
        # Don't raise — webhooks must be idempotent + always 200 to Stripe.
