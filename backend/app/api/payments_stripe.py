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

    # Customer-credit redemption — reduce what the client pays by any available
    # credit. GATED: this rides the same not-yet-live-Stripe-verified capture
    # path as the rest of PR #30, so it only runs when
    # CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED is flipped on. When on, the net
    # (reduced) amount is charged AND _mark_payment_paid's amount check subtracts
    # the recorded redemption so capture verification stays consistent.
    from app.services import escrow, credits

    if credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED:
        gross_cents = escrow.to_cents(amount)
        redemption = credits.redeem_credit_for_booking(
            user_id=current_user["id"],
            booking_id=booking_id,
            gross_amount_cents=gross_cents,
        )
        amount = escrow.to_dollars(redemption["net_amount_cents"])
        if amount <= 0:
            # Credit fully covers the booking — nothing left to charge via
            # Stripe. (Not yet reachable while the flag is OFF.)
            raise HTTPException(
                status_code=400,
                detail="Credit covers the full amount; no Stripe charge needed",
            )

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
        event_id = event["id"]
    except (KeyError, TypeError):
        event_id = getattr(event, "id", None)

    try:
        data_object = event["data"]["object"]
    except (KeyError, TypeError):
        data_object = None

    # fix E: idempotency. A replayed event must not re-run side effects (e.g.
    # regress a fully_released payment back to paid_full). If we've already
    # recorded this Stripe event id, ack and stop.
    if event_id:
        try:
            seen = (
                supabase.table("stripe_events")
                .select("event_id")
                .eq("event_id", event_id)
                .execute()
            )
            if seen.data:
                logger.info("Stripe webhook duplicate ignored: %s", event_id)
                return {"received": True, "duplicate": True, "type": etype}
        except Exception:
            # If the dedupe table is unreachable, fall through — _mark_payment_paid
            # is itself status-guarded so a double-apply is still safe.
            logger.warning("stripe_events dedupe check failed for %s", event_id)

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
        # Amount actually paid (cents) and the PaymentIntent id, for amount
        # verification and refund traceability.
        amount_total = _obj_get(data_object, "amount_total")
        payment_intent = _obj_get(data_object, "payment_intent")
        if booking_id:
            _mark_payment_paid(booking_id, session_id, amount_total, payment_intent)
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

    # fix E: record the event id so a Stripe retry/replay is deduped above.
    if event_id:
        try:
            supabase.table("stripe_events").insert(
                {"event_id": event_id, "event_type": etype}
            ).execute()
        except Exception:
            logger.warning("Could not record processed stripe event %s", event_id)

    return {"received": True, "type": etype}


def _obj_get(obj, key):
    """Read a field from a Stripe object (dict-or-StripeObject), else None."""
    if obj is None:
        return None
    try:
        return obj[key]
    except (KeyError, TypeError):
        return getattr(obj, key, None)


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
    booking_id: str,
    stripe_session_id: str | None,
    amount_total_cents: int | None = None,
    payment_intent_id: str | None = None,
) -> None:
    """
    On `checkout.session.completed`, confirm the on-platform CAPTURE.

    The /interests accept flow inserted a payments row with status='pending'
    (full amount held in escrow, nothing released). Stripe having captured the
    charge, we transition pending → paid_full: the full amount is now genuinely
    held in escrow. Release to the business still happens only at
    /bookings/{id}/complete.

    fix A: the Stripe id goes into `stripe_payment_intent_id` (a real column),
    never the phantom `notes` column that 400'd this write.
    fix E: (1) verify the paid amount matches the booking total before marking
    paid; (2) never regress a fully_released / refunded / off-platform row.
    """
    from app.services import escrow

    booking_res = (
        supabase.table("bookings")
        .select("total_amount")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    expected_cents = (
        escrow.to_cents(booking_res.data.get("total_amount"))
        if booking_res.data
        else None
    )

    # If credit was redeemed at checkout, Stripe captured the REDUCED (net)
    # amount — subtract the recorded redemption so the mismatch check compares
    # against what we actually asked Stripe to charge. No-op (subtract 0) for
    # bookings with no redemption, so this is safe while redemption is gated off.
    if expected_cents is not None:
        from app.services import credits

        redeemed = credits._existing_redemption_cents(booking_id)
        if redeemed:
            expected_cents = max(expected_cents - redeemed, 0)

    # Amount verification — refuse to mark paid if Stripe charged a different
    # amount than the booking total. Better to leave it pending for review than
    # to silently accept an under/over-charge.
    if (
        amount_total_cents is not None
        and expected_cents is not None
        and int(amount_total_cents) != expected_cents
    ):
        logger.error(
            "Stripe amount mismatch for booking %s: paid=%s expected=%s cents — "
            "NOT marking paid. Needs manual review.",
            booking_id,
            amount_total_cents,
            expected_cents,
        )
        return

    payment = escrow.load_single_payment(booking_id)
    if not payment:
        logger.error(
            "Stripe capture for booking %s but no payments row exists", booking_id
        )
        return

    # Regression guard: a replayed event must not knock a released/refunded/
    # off-platform payment back to paid_full.
    if payment.get("status") in ("fully_released", "refunded", "paid_off_platform"):
        logger.info(
            "Stripe capture for booking %s ignored — payment already %s",
            booking_id,
            payment.get("status"),
        )
        return

    update: dict = {
        # Vocabulary per migration 0001 (applied 2026-07-22): 'paid_full' was
        # renamed to 'held' and is no longer accepted by payments_status_check.
        # Writing the old value 500s the capture webhook with a 23514.
        "status": "held",
        # Capture confirmed → the full charge is now held in escrow.
        "escrow_held": float(payment.get("total_charged") or 0),
    }
    if payment_intent_id:
        update["stripe_payment_intent_id"] = payment_intent_id
    elif stripe_session_id:
        # No PaymentIntent on the event — fall back to the session id so the
        # capture is still traceable in a real column (not `notes`).
        update["stripe_payment_intent_id"] = stripe_session_id
    try:
        supabase.table("payments").update(update).eq("id", payment["id"]).execute()
    except Exception:
        logger.exception("Could not mark payment paid for booking %s", booking_id)
        # Don't raise — webhooks must be idempotent + always 200 to Stripe.

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
