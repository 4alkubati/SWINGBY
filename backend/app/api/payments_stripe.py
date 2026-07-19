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
    Handles `checkout.session.completed`: the FULL amount is now captured and
    held on the platform's Stripe balance (CARD-21 Uber model — nothing is
    released to the business here; that only happens at booking completion).
    Other event types ack.
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
    description = (
        f"SwingBy — {booking.get('service_category') or 'booking'} #{booking_id[:8]}"
    )

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
        business_id = metadata.get("business_id") if hasattr(metadata, "get") else None
        session_id = None
        try:
            session_id = data_object["id"]
        except (KeyError, TypeError):
            session_id = getattr(data_object, "id", None)
        payment_intent_id = None
        try:
            payment_intent_id = data_object["payment_intent"]
        except (KeyError, TypeError):
            payment_intent_id = getattr(data_object, "payment_intent", None)
        if booking_id:
            _mark_payment_paid(booking_id, session_id, payment_intent_id)
        elif business_id:
            # D2.4 — subscription checkout completed
            try:
                sub_id = (
                    data_object.get("subscription")
                    if hasattr(data_object, "get")
                    else None
                )
                supabase.table("businesses").update(
                    {
                        "subscription_status": "active",
                        "subscription_id": sub_id,
                        "subscription_started_at": "now()",
                    }
                ).eq("id", business_id).execute()
            except Exception:
                logger.exception(
                    "Could not activate subscription for business %s", business_id
                )
        else:
            logger.warning(
                "checkout.session.completed missing booking_id / business_id metadata"
            )
    elif (
        etype
        in (
            "customer.subscription.updated",
            "customer.subscription.created",
            "customer.subscription.deleted",
        )
        and data_object is not None
    ):
        _sync_subscription(data_object)
    elif etype == "invoice.payment_failed" and data_object is not None:
        _mark_past_due(data_object)
    else:
        logger.info("Stripe webhook event ignored: %s", etype)

    return {"received": True, "type": etype}


def _sync_subscription(sub_obj) -> None:
    """Reflect Stripe subscription state onto the businesses row."""
    try:
        sub_id = sub_obj["id"] if not hasattr(sub_obj, "get") else sub_obj.get("id")
        status = sub_obj.get("status") if hasattr(sub_obj, "get") else sub_obj["status"]
        customer_id = (
            sub_obj.get("customer") if hasattr(sub_obj, "get") else sub_obj["customer"]
        )
        current_period_end = (
            sub_obj.get("current_period_end") if hasattr(sub_obj, "get") else None
        )
        cancel_at = sub_obj.get("cancel_at") if hasattr(sub_obj, "get") else None
        update = {"subscription_status": status, "subscription_id": sub_id}
        if current_period_end:
            from datetime import datetime, timezone

            update["subscription_current_period_end"] = datetime.fromtimestamp(
                current_period_end, tz=timezone.utc
            ).isoformat()
        if cancel_at:
            from datetime import datetime, timezone

            update["subscription_cancel_at"] = datetime.fromtimestamp(
                cancel_at, tz=timezone.utc
            ).isoformat()
        supabase.table("businesses").update(update).eq(
            "stripe_customer_id", customer_id
        ).execute()
    except Exception:
        logger.exception("Could not sync subscription")


def _mark_past_due(invoice_obj) -> None:
    try:
        customer_id = (
            invoice_obj.get("customer")
            if hasattr(invoice_obj, "get")
            else invoice_obj["customer"]
        )
        supabase.table("businesses").update({"subscription_status": "past_due"}).eq(
            "stripe_customer_id", customer_id
        ).execute()
    except Exception:
        logger.exception("Could not mark subscription past_due")


def _mark_payment_paid(
    booking_id: str, stripe_session_id: str | None, stripe_payment_intent_id: str | None = None
) -> None:
    """
    On `checkout.session.completed`, finalize the on-platform accounting.

    CARD-21 — Uber model. The /interests accept flow inserted a payments row
    at $0 held / $0 released (status='pending'). Stripe just captured the
    FULL amount into the platform's own Stripe balance — nothing is owed to
    the business yet. So: escrow_held = total_charged, released_to_business
    stays 0, status -> 'paid_full' (meaning "captured & held", not "paid
    out"). The release at completion (/bookings/{id}/complete) is what
    actually pays the business.
    """
    try:
        booking_res = (
            supabase.table("bookings")
            .select("id")
            .eq("id", booking_id)
            .single()
            .execute()
        )
        if not booking_res.data:
            logger.warning("checkout.session.completed for unknown booking %s", booking_id)
            return
    except Exception:
        logger.exception("Could not look up booking %s for webhook", booking_id)
        return

    try:
        pay_res = (
            supabase.table("payments")
            .select("id, total_charged")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        total_charged = float((pay_res.data or {}).get("total_charged") or 0)
    except Exception:
        total_charged = 0.0

    update: dict = {
        "status": "paid_full",
        "escrow_held": total_charged,
        "released_to_business": 0,
    }
    if stripe_session_id:
        update["notes"] = f"stripe_session={stripe_session_id}"
    try:
        supabase.table("payments").update(update).eq("booking_id", booking_id).execute()
    except Exception:
        logger.exception("Could not mark payment paid for booking %s", booking_id)
        # Don't raise — webhooks must be idempotent + always 200 to Stripe.

    # Booking-level payment_status mirrors the hold — 'held' is already a
    # valid value in bookings_payment_status_check (unused until now).
    try:
        supabase.table("bookings").update({"payment_status": "held"}).eq(
            "id", booking_id
        ).execute()
    except Exception:
        logger.exception("Could not set booking %s payment_status to held", booking_id)

    # CARD-21 money ledger — best-effort, never breaks the webhook.
    try:
        from app.services import money_ledger

        money_ledger.record_capture(
            booking_id=booking_id,
            stripe_checkout_session_id=stripe_session_id,
            stripe_payment_intent_id=stripe_payment_intent_id,
            actual_captured_amount=total_charged if total_charged else None,
        )
    except Exception:
        logger.warning("Could not record ledger capture for booking %s", booking_id, exc_info=True)

    # Email the client a payment receipt — best-effort, never raises
    try:
        from app.services.email import send_payment_receipt

        booking_res = (
            supabase.table("bookings")
            .select("client_id, total_amount")
            .eq("id", booking_id)
            .single()
            .execute()
        )
        if booking_res.data:
            client_id = booking_res.data["client_id"]
            amount = float(booking_res.data.get("total_amount") or 0)
            client_user_res = (
                supabase.table("users")
                .select("email, first_name")
                .eq("id", client_id)
                .single()
                .execute()
            )
            if client_user_res.data and amount > 0:
                send_payment_receipt(
                    client_user_res.data["email"],
                    client_user_res.data["first_name"],
                    booking_id,
                    amount,
                )
    except Exception:
        logger.warning("payment receipt email failed for booking %s", booking_id)
