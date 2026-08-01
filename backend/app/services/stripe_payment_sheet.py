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

# Apple Pay's merchant id, served to the device rather than baked into the app.
#
# The iOS ENTITLEMENT still has to be decided at build time (app.config.js reads
# STRIPE_MERCHANT_IDENTIFIER), because an entitlement naming a merchant id Apple
# has never heard of fails provisioning. But whether the sheet OFFERS the wallet
# is a runtime question, and answering it from the server means Apple Pay turns
# on for every already-installed build the moment this variable is set — no
# rebuild, no resubmission.
#
# Empty is the off position of a finished switch, not an unbuilt feature.
APPLE_MERCHANT_ID = os.getenv("STRIPE_MERCHANT_IDENTIFIER", "").strip()

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
            # Keep the card on file. Until this was set, `ensure_customer` built
            # the shelf — a persistent Stripe Customer, reused on every payment,
            # handed to the sheet with an ephemeral key so saved cards render —
            # and nothing was ever put on it: the card was discarded after each
            # charge, so the sheet had nothing to show the next time.
            #
            # 'off_session' rather than 'on_session' deliberately. It is what
            # lets a later PaymentIntent charge this card with the client absent,
            # which is the missing piece under charge-at-post (a client posting a
            # job is not standing at a payment sheet). 'on_session' would save
            # the card but refuse exactly that use.
            #
            # CONSENT: this saves without a Stripe checkbox, so the disclosure
            # has to be ours. It lives on the Payments screen
            # (mobile/src/screens/profile/PaymentMethodScreen.js), which used to
            # claim the opposite — "you never have to hold a card on file" — and
            # was corrected in the same change. Do not turn this on anywhere the
            # client has not been told.
            setup_future_usage="off_session",
            # The webhook reads booking_id off THIS metadata to move the ledger.
            # Without it a succeeded intent cannot be attributed to a booking and
            # _mark_payment_paid is never called. Do not drop this key.
            # swingby_user_id is what lets the succeeded event remember the card
            # against the right user without a booking lookup.
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
        "apple_merchant_id": APPLE_MERCHANT_ID or None,
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
        # Which card actually paid. Read back from Stripe rather than taken from
        # the device, for the same reason as everything else here.
        "payment_method": (
            intent.get("payment_method") if hasattr(intent, "get") else None
        ),
    }


def remember_payment_method(*, user_id: str, payment_method_id: Optional[str]) -> None:
    """Record the card a succeeded intent used as this user's default.

    `setup_future_usage='off_session'` is what makes Stripe KEEP the card on the
    Customer; this is what makes SwingBy able to name it later. Without it,
    charging at post would mean listing the Customer's payment methods and
    guessing which one the client meant.

    ``users.default_payment_method_id`` has existed as a column since the
    account-lifecycle work and had no reader or writer until now.

    Best-effort by design: a bookkeeping write must never fail a payment that
    Stripe has already captured. The card is still saved on the Stripe Customer
    either way, so the worst case is that the next charge has to look it up.
    """
    if not user_id or not payment_method_id:
        return
    try:
        supabase.table("users").update(
            {"default_payment_method_id": str(payment_method_id)}
        ).eq("id", user_id).execute()
    except Exception:
        logger.warning(
            "Could not persist default_payment_method_id for user %s — the card "
            "is still saved on the Stripe customer.",
            user_id,
            exc_info=True,
        )


# ── Card on file (M2) ────────────────────────────────────────────────────────
#
# Until now a card was retained only as a SIDE EFFECT of paying once: the
# PaymentIntent carried setup_future_usage='off_session', so Stripe kept the
# card on the Customer, and `remember_payment_method` recorded which one. That
# gave us a saved card nobody could see, choose, or delete — the client had to
# re-enter a card whenever the sheet did not offer it back, and there was no
# answer at all to "what card do you have of mine, and take it off".
#
# A SetupIntent is the same flow with no charge attached: the client adds a card
# deliberately, before there is anything to pay for.


def create_setup_intent(
    *, user_id: str, email: Optional[str], name: Optional[str]
) -> dict[str, Any]:
    """Everything the native sheet needs to SAVE a card without charging it.

    Same envelope shape as `create_payment_sheet` so the mobile side can reuse
    its initPaymentSheet plumbing verbatim.
    """
    stripe = _stripe()
    customer_id = ensure_customer(user_id=user_id, email=email, name=name)

    ephemeral = stripe.EphemeralKey.create(
        customer=customer_id,
        stripe_version="2024-06-20",
    )
    intent = stripe.SetupIntent.create(
        customer=customer_id,
        usage="off_session",
        automatic_payment_methods={"enabled": True},
        metadata={"swingby_user_id": str(user_id)},
    )
    return {
        "setup_intent_client_secret": intent["client_secret"],
        "ephemeral_key": ephemeral["secret"],
        "customer_id": customer_id,
        "publishable_key": publishable_key(),
        "merchant_display_name": MERCHANT_DISPLAY_NAME,
        "apple_merchant_id": APPLE_MERCHANT_ID or None,
    }


def list_payment_methods(*, user_id: str) -> list[dict[str, Any]]:
    """The client's saved cards, in the shape the app renders.

    Only the four fields a human needs to recognise a card. Never the full PAN
    — Stripe does not return it and we would not store it if it did.
    """
    customer_id = _existing_customer_id(user_id)
    if not customer_id:
        return []

    stripe = _stripe()
    methods = stripe.PaymentMethod.list(customer=customer_id, type="card")
    default_id = _default_payment_method_id(user_id)

    out = []
    for m in methods.get("data", []) or []:
        card = m.get("card") or {}
        out.append(
            {
                "id": m.get("id"),
                "brand": card.get("brand"),
                "last4": card.get("last4"),
                "exp_month": card.get("exp_month"),
                "exp_year": card.get("exp_year"),
                "is_default": m.get("id") == default_id,
            }
        )
    return out


def detach_payment_method(*, user_id: str, payment_method_id: str) -> None:
    """Remove a saved card.

    OWNERSHIP IS CHECKED AGAINST STRIPE, not against our own table. The id comes
    from the client, and `PaymentMethod.detach` would happily detach a card
    belonging to somebody else's Customer if we simply passed it through.
    """
    customer_id = _existing_customer_id(user_id)
    if not customer_id:
        raise PermissionError("No saved cards for this account")

    stripe = _stripe()
    method = stripe.PaymentMethod.retrieve(payment_method_id)
    if (method or {}).get("customer") != customer_id:
        raise PermissionError("That payment method belongs to another account")

    stripe.PaymentMethod.detach(payment_method_id)

    # Drop it as the default too, or the next off-session charge names a card
    # Stripe no longer has.
    if _default_payment_method_id(user_id) == payment_method_id:
        try:
            supabase.table("users").update({"default_payment_method_id": None}).eq(
                "id", user_id
            ).execute()
        except Exception:
            logger.warning(
                "Detached %s but could not clear default_payment_method_id",
                payment_method_id,
                exc_info=True,
            )


def _existing_customer_id(user_id: str) -> Optional[str]:
    """The user's Stripe customer, WITHOUT creating one.

    `ensure_customer` would mint a Customer just to list zero cards, leaving
    empty Customers in Stripe for every user who opened the payments screen.
    """
    try:
        res = (
            supabase.table("users")
            .select("stripe_customer_id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return (rows[0].get("stripe_customer_id") if rows else None) or None
    except Exception:
        logger.warning("Could not read stripe_customer_id", exc_info=True)
        return None


def _default_payment_method_id(user_id: str) -> Optional[str]:
    try:
        res = (
            supabase.table("users")
            .select("default_payment_method_id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return (rows[0].get("default_payment_method_id") if rows else None) or None
    except Exception:
        return None
