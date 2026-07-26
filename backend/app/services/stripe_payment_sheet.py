"""
stripe_payment_sheet.py — the Stripe objects a NATIVE Payment Sheet needs.

M9 (walkthrough audit 2026-07-24): "Uber doesn't bounce you to a hosted page."
Hosted Checkout hands the client a URL and `Linking.openURL` throws them into a
browser. Stripe's native Payment Sheet renders inside the app instead, but it
needs three things this module produces:

    customer        a Stripe Customer id, so saved cards survive between jobs
    ephemeral_key   a short-lived key letting the DEVICE read that customer
    client_secret   the PaymentIntent the sheet confirms

This module is deliberately separate from ``stripe_service.py``: that file is
owned elsewhere this session and already carries the hosted-Checkout, refund and
webhook-verification helpers. It reuses ``stripe_service``'s key validation
(``_require_stripe``) rather than re-implementing it, so a masked/blank
STRIPE_SECRET_KEY fails here with the same message it fails with everywhere else
(SEN-1).

MONEY SEMANTICS — unchanged.
This module creates a PaymentIntent with the DEFAULT capture method, i.e. the
charge is captured immediately, exactly as ``create_checkout_session`` does.
Nothing here writes to ``payments``. The ledger is only ever moved by
``payments_stripe._mark_payment_paid`` off the verified webhook, which is the
same function the hosted-Checkout path has always used. A native sheet is a new
way to ASK for money; it is not a new way to account for it.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from fastapi import HTTPException

from app.services.stripe_service import StripeNotConfigured, _require_stripe
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

# The name shown at the top of the native sheet. Branding, per
# design/handoff-jet-pulse/PAYMENTS.md — the sheet must read as SwingBy, not as
# "some Stripe page".
MERCHANT_DISPLAY_NAME = "SwingBy"

CURRENCY = "cad"


def publishable_key() -> str:
    """The pk_test_… / pk_live_… key the device needs to talk to Stripe.

    Read straight from the environment rather than ``app.config.settings`` so
    this lane adds no field to a settings module another lane owns. Empty is a
    legitimate state: the mobile client treats "no publishable key" as "native
    sheet unavailable" and falls back to hosted Checkout.

    Publishable keys are public by design — this is not a secret leak.
    """
    return os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip()


def _stripe():
    """The configured stripe SDK, or HTTPException(503)."""
    try:
        return _require_stripe()
    except StripeNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc))


def ensure_customer(*, user_id: str, email: Optional[str], name: Optional[str]) -> str:
    """Return this user's Stripe Customer id, creating and persisting it once.

    ``users.stripe_customer_id`` is a real column (verified against the live
    database 2026-07-23 — see the schema note in app/api/auth.py). Reusing it is
    what makes a saved card show up on the client's NEXT booking instead of
    making them retype it, which is half of why the native sheet feels like Uber.

    If the persist write fails we still return the customer id: the payment
    should not be blocked by a bookkeeping failure. Worst case the client gets a
    fresh customer next time and re-enters the card.
    """
    stripe = _stripe()

    try:
        res = (
            supabase.table("users")
            .select("stripe_customer_id")
            .eq("id", user_id)
            .single()
            .execute()
        )
        existing = (res.data or {}).get("stripe_customer_id")
    except Exception:
        existing = None

    if existing:
        return existing

    try:
        customer = stripe.Customer.create(
            email=email or None,
            name=name or None,
            metadata={"swingby_user_id": str(user_id)},
        )
    except Exception:
        logger.exception("stripe.Customer.create failed for user %s", user_id)
        raise HTTPException(status_code=502, detail="Could not start the payment")

    customer_id = customer["id"]

    try:
        supabase.table("users").update({"stripe_customer_id": customer_id}).eq(
            "id", user_id
        ).execute()
    except Exception:
        logger.warning(
            "Could not persist stripe_customer_id for user %s — the payment "
            "still proceeds, but the card will not be remembered.",
            user_id,
        )

    return customer_id


def create_payment_sheet(
    *,
    booking_id: str,
    amount_cents: int,
    description: str,
    user_id: str,
    email: Optional[str] = None,
    name: Optional[str] = None,
) -> dict[str, Any]:
    """Create the customer / ephemeral key / PaymentIntent triple.

    ``amount_cents`` is integer cents and is passed to Stripe verbatim — this
    function does no money arithmetic. The caller has already resolved the
    authoritative amount (booking total, minus any credit redemption) exactly
    the way the hosted-Checkout endpoint resolves it.

    Returns ``{payment_intent_id, client_secret, ephemeral_key, customer_id,
    publishable_key, amount_cents, currency, merchant_display_name}``.
    """
    stripe = _stripe()

    amount_cents = int(amount_cents)
    if amount_cents <= 0:
        raise HTTPException(status_code=400, detail="amount must be greater than zero")

    customer_id = ensure_customer(user_id=user_id, email=email, name=name)

    try:
        ephemeral_key = stripe.EphemeralKey.create(
            customer=customer_id,
            stripe_version=stripe.api_version,
        )
    except Exception:
        logger.exception(
            "stripe.EphemeralKey.create failed for customer %s", customer_id
        )
        raise HTTPException(status_code=502, detail="Could not start the payment")

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=CURRENCY,
            customer=customer_id,
            description=description,
            # `allow_redirects: never` is the whole point of M9. Left on
            # "always", Stripe can offer methods that punt the client out to a
            # bank's web page — which is the browser bounce we are removing.
            # Card (and any other in-sheet method) only.
            automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
            # The webhook reads booking_id off THIS metadata to move the ledger.
            # Without it a succeeded intent cannot be attributed to a booking and
            # _mark_payment_paid is never called. Do not drop this key.
            metadata={"booking_id": str(booking_id), "swingby_user_id": str(user_id)},
        )
    except Exception:
        logger.exception(
            "stripe.PaymentIntent.create failed for booking %s", booking_id
        )
        raise HTTPException(status_code=502, detail="Could not start the payment")

    return {
        "payment_intent_id": intent["id"],
        "client_secret": intent["client_secret"],
        "ephemeral_key": ephemeral_key["secret"],
        "customer_id": customer_id,
        "publishable_key": publishable_key(),
        "amount_cents": amount_cents,
        "currency": CURRENCY,
        "merchant_display_name": MERCHANT_DISPLAY_NAME,
    }


def retrieve_payment_intent(payment_intent_id: str) -> dict[str, Any]:
    """Fetch a PaymentIntent from Stripe, as the source of truth on its status.

    The device says "the sheet succeeded". That claim is not evidence — a
    hostile or buggy client could make it about any intent id. Everything that
    moves the ledger is read back from Stripe here: the real status, the real
    ``amount_received``, and the ``metadata.booking_id`` the intent was created
    with, so the caller can prove the intent belongs to the booking being
    settled.
    """
    stripe = _stripe()
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
    except Exception:
        logger.exception(
            "stripe.PaymentIntent.retrieve failed for %s", payment_intent_id
        )
        raise HTTPException(status_code=502, detail="Could not verify the payment")

    metadata = intent.get("metadata") if hasattr(intent, "get") else None
    return {
        "id": intent["id"],
        "status": intent["status"],
        "amount_received": (
            intent.get("amount_received") if hasattr(intent, "get") else None
        ),
        "booking_id": (metadata or {}).get("booking_id") if metadata else None,
    }
