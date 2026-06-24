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
from typing import Any

from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger(__name__)


class StripeNotConfigured(RuntimeError):
    """Raised when an endpoint is hit but STRIPE_SECRET_KEY is unset."""


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
                    "product_data": {"name": description or f"SwingBy booking {booking_id}"},
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
        logger.exception("stripe.checkout.Session.create failed for booking %s", booking_id)
        raise HTTPException(status_code=502, detail="Could not create Stripe checkout session")

    return {"id": session["id"], "url": session["url"]}


def verify_webhook(payload_bytes: bytes, signature_header: str | None) -> dict[str, Any]:
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
