"""
stripe_service.py — Stripe sandbox/live integration helpers.

Beta uses Stripe test mode end-to-end. Keys come from env (STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET) and are optional at boot — the API surface is registered
unconditionally so the FastAPI app stays healthy in environments where Stripe
is intentionally not configured (e.g. local dev without keys). Endpoints
themselves return 503 if invoked while keys are absent.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from fastapi import HTTPException

from app.config import settings
from app.services import money

logger = logging.getLogger(__name__)


class StripeNotConfigured(RuntimeError):
    """Raised when an endpoint is hit but STRIPE_SECRET_KEY is unset."""


class CardChargeError(Exception):
    """
    Raised when an off-session card charge is declined or otherwise fails at
    quote-acceptance time (PAYMENT-MODEL.md §5).

    Callers must treat this as "no booking, interest stays pending, post
    stays open" — see backend/app/api/interests.py::accept_interest. The
    message is written to be shown directly to the client.
    """


def _require_stripe():
    """Import + configure the stripe SDK, or raise StripeNotConfigured."""
    if not settings.STRIPE_SECRET_KEY:
        raise StripeNotConfigured(
            "Stripe is not configured on this environment. "
            "Set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET) to enable payments."
        )
    try:
        import stripe  # local import — never crash boot just because lib missing
    except ImportError as exc:
        raise StripeNotConfigured(
            "The `stripe` package is not installed. Add `stripe` to "
            "backend/requirements.txt and pip-install."
        ) from exc
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def create_checkout_session(
    *,
    booking_id: str,
    amount_cad: float,
    description: str,
    client_email: str | None = None,
) -> dict[str, Any]:
    """
    Create a Stripe Checkout Session for a confirmed booking.

    Returns: dict with keys {id, url}. Caller should redirect the client browser
    (or open it via Linking.openURL on mobile) to `url`.

    Raises HTTPException(503) if Stripe is not configured.
    """
    try:
        stripe = _require_stripe()
    except StripeNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    amount_cents = int(round(amount_cad * 100))
    if amount_cents <= 0:
        raise HTTPException(status_code=400, detail="amount must be greater than zero")

    session_kwargs: dict[str, Any] = {
        "mode": "payment",
        "payment_method_types": ["card"],
        "line_items": [
            {
                "price_data": {
                    "currency": "cad",
                    "unit_amount": amount_cents,
                    "product_data": {
                        "name": description or f"SwingBy booking {booking_id}"
                    },
                },
                "quantity": 1,
            }
        ],
        "metadata": {"booking_id": booking_id},
        "success_url": settings.STRIPE_SUCCESS_URL + "?booking_id=" + booking_id,
        "cancel_url": settings.STRIPE_CANCEL_URL + "?booking_id=" + booking_id,
    }
    if client_email:
        session_kwargs["customer_email"] = client_email

    try:
        session = stripe.checkout.Session.create(**session_kwargs)
    except Exception:
        logger.exception(
            "stripe.checkout.Session.create failed for booking %s", booking_id
        )
        raise HTTPException(
            status_code=502, detail="Could not create Stripe checkout session"
        )

    return {"id": session["id"], "url": session["url"]}


def verify_webhook(
    payload_bytes: bytes, signature_header: str | None
) -> dict[str, Any]:
    """
    Verify the Stripe webhook signature and return the parsed event.

    Raises HTTPException(503) if Stripe is not configured,
           HTTPException(400) if signature verification fails.
    """
    try:
        stripe = _require_stripe()
    except StripeNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="STRIPE_WEBHOOK_SECRET is not set; cannot verify webhook signature.",
        )

    if not signature_header:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload_bytes,
            sig_header=signature_header,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    except Exception:
        logger.warning("stripe webhook signature verification failed", exc_info=True)
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    return event


# ── Card on file (PAYMENT-MODEL.md §5) ──────────────────────────────────────


def get_or_create_customer(
    *, user_id: str, email: str | None, existing_customer_id: str | None
) -> str:
    """
    Returns a Stripe Customer id for this user, creating one if needed.

    Raises HTTPException(503) if Stripe is not configured.
    """
    if existing_customer_id:
        return existing_customer_id

    stripe = _require_stripe()
    try:
        customer = stripe.Customer.create(
            email=email, metadata={"swingby_user_id": user_id}
        )
    except Exception:
        logger.exception("stripe.Customer.create failed for user %s", user_id)
        raise HTTPException(status_code=502, detail="Could not create Stripe customer")
    return customer["id"]


def create_setup_intent(*, customer_id: str) -> dict[str, Any]:
    """
    Creates a SetupIntent for the given customer so the client SDK can
    collect + confirm a card without charging it. Returns {id, client_secret}.
    """
    stripe = _require_stripe()
    try:
        intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
        )
    except Exception:
        logger.exception(
            "stripe.SetupIntent.create failed for customer %s", customer_id
        )
        raise HTTPException(status_code=502, detail="Could not create setup intent")
    return {"id": intent["id"], "client_secret": intent["client_secret"]}


def attach_payment_method(*, customer_id: str, payment_method_id: str) -> None:
    """
    Attaches a confirmed PaymentMethod to the customer and sets it as the
    default for future off-session charges (invoice_settings +
    the explicit payment_method_id we also persist on `users`).
    """
    stripe = _require_stripe()
    try:
        stripe.PaymentMethod.attach(payment_method_id, customer=customer_id)
        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": payment_method_id},
        )
    except Exception:
        logger.exception(
            "Could not attach payment method %s to customer %s",
            payment_method_id,
            customer_id,
        )
        raise HTTPException(
            status_code=502, detail="Could not save card — please try again"
        )


# ── Off-session capture (PAYMENT-MODEL.md §5) ───────────────────────────────


def charge_off_session(
    *,
    customer_id: str,
    payment_method_id: str,
    amount: Decimal,
    idempotency_key: str,
    description: str = "",
) -> dict[str, Any]:
    """
    Charges the customer's saved card off-session for `amount` (a Decimal,
    CAD). `idempotency_key` MUST be derived from a stable identifier (the
    interest_id) so a retried or double-tapped acceptance cannot double-charge
    — Stripe collapses repeated calls with the same key into the original
    PaymentIntent instead of creating a second charge.

    Raises:
        HTTPException(503) — Stripe not configured.
        CardChargeError     — the card was declined or the charge otherwise
                               failed. Message is safe to show the client.
    """
    stripe = _require_stripe()
    cents = money.to_cents(amount)
    if cents <= 0:
        raise CardChargeError("Amount must be greater than zero")

    try:
        intent = stripe.PaymentIntent.create(
            amount=cents,
            currency=money.CURRENCY.lower(),
            customer=customer_id,
            payment_method=payment_method_id,
            off_session=True,
            confirm=True,
            description=description or None,
            idempotency_key=idempotency_key,
        )
    except stripe.error.CardError as exc:
        user_message = getattr(exc, "user_message", None)
        raise CardChargeError(
            user_message or "Your card was declined — try another card."
        ) from exc
    except Exception as exc:
        logger.exception("stripe.PaymentIntent.create failed (off-session charge)")
        raise CardChargeError("Could not process payment — please try again.") from exc

    return {"id": intent["id"], "status": intent["status"]}

    return event
