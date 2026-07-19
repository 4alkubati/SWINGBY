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


def create_refund(
    *,
    payment_intent_id: str,
    amount_cad: float,
    reason: str | None = None,
    metadata: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Refund part or all of a captured PaymentIntent, out of the PLATFORM's own
    Stripe balance — never a clawback from the business (the business never
    receives funds until `complete_booking`, so there's nothing to claw back).

    Returns: dict with keys {id, status, amount}. Raises HTTPException(503) if
    Stripe is not configured, HTTPException(502) if the refund call fails.
    """
    try:
        stripe = _require_stripe()
    except StripeNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    amount_cents = int(round(amount_cad * 100))
    if amount_cents <= 0:
        raise HTTPException(status_code=400, detail="refund amount must be > 0")

    kwargs: dict[str, Any] = {
        "payment_intent": payment_intent_id,
        "amount": amount_cents,
    }
    if reason:
        kwargs["reason"] = reason
    if metadata:
        kwargs["metadata"] = metadata

    try:
        refund = stripe.Refund.create(**kwargs)
    except Exception:
        logger.exception(
            "stripe.Refund.create failed for payment_intent %s", payment_intent_id
        )
        raise HTTPException(status_code=502, detail="Could not create Stripe refund")

    return {"id": refund["id"], "status": refund["status"], "amount": refund["amount"]}


def create_transfer(
    *,
    destination_account_id: str,
    amount_cad: float,
    transfer_group: str | None = None,
    metadata: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Move the business's completed-job share from the platform balance to a
    connected Stripe account.

    NOT wired into any live endpoint yet — SwingBy has no Stripe Connect
    onboarding flow, so no business row has a connected account id to target.
    This is a forward-compatible primitive for the card that adds Connect
    onboarding; unit-tested here so the money math is provable ahead of that
    work. Calling this against a real destination requires STRIPE_SECRET_KEY
    plus a live `acct_...` id.

    Returns: dict with keys {id, status, amount}. Raises HTTPException(503) if
    Stripe is not configured, HTTPException(502) if the transfer call fails.
    """
    try:
        stripe = _require_stripe()
    except StripeNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    amount_cents = int(round(amount_cad * 100))
    if amount_cents <= 0:
        raise HTTPException(status_code=400, detail="transfer amount must be > 0")

    kwargs: dict[str, Any] = {
        "amount": amount_cents,
        "currency": "cad",
        "destination": destination_account_id,
    }
    if transfer_group:
        kwargs["transfer_group"] = transfer_group
    if metadata:
        kwargs["metadata"] = metadata

    try:
        transfer = stripe.Transfer.create(**kwargs)
    except Exception:
        logger.exception(
            "stripe.Transfer.create failed for destination %s", destination_account_id
        )
        raise HTTPException(status_code=502, detail="Could not create Stripe transfer")

    return {"id": transfer["id"], "status": "created", "amount": transfer["amount"]}


def retrieve_payment_intent(payment_intent_id: str) -> dict[str, Any] | None:
    """
    Fetch the actual captured amount / status for reconciliation (money
    ledger). Returns None (never raises) if Stripe is unavailable or the
    lookup fails — reconciliation is a best-effort verification layer, it
    must not break the caller.
    """
    try:
        stripe = _require_stripe()
    except StripeNotConfigured:
        return None
    try:
        pi = stripe.PaymentIntent.retrieve(payment_intent_id)
    except Exception:
        logger.warning(
            "stripe.PaymentIntent.retrieve failed for %s", payment_intent_id, exc_info=True
        )
        return None
    return {
        "id": pi["id"],
        "status": pi["status"],
        "amount": pi["amount"],
        "amount_received": pi.get("amount_received"),
        "latest_charge": pi.get("latest_charge"),
    }


def retrieve_charge_fee(charge_id: str) -> float | None:
    """
    Fetch the actual Stripe processing fee for a charge (via its balance
    transaction), in dollars. Returns None (never raises) if unavailable.
    """
    try:
        stripe = _require_stripe()
    except StripeNotConfigured:
        return None
    try:
        charge = stripe.Charge.retrieve(charge_id, expand=["balance_transaction"])
        bt = charge.get("balance_transaction")
        fee_cents = bt.get("fee") if bt and hasattr(bt, "get") else None
    except Exception:
        logger.warning("stripe.Charge.retrieve failed for %s", charge_id, exc_info=True)
        return None
    if fee_cents is None:
        return None
    return round(fee_cents / 100, 2)


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
