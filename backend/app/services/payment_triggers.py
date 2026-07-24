"""
payment_triggers.py — Charge-before-service. WHEN money is demanded.

Product-owner ruling (Kira, 2026-07-21, re-confirmed 2026-07-23): money is
collected BEFORE any work happens, and there are **two triggers**:

  1. POST   — the client posts a job.
  2. ACCEPT — the client accepts a business's quote in chat.

Before this module there were ZERO automatic triggers. The only way money could
start moving was a client tapping an optional "Pay with card" button on the
booking details screen, *after* the booking already existed. It could be
skipped, and the job proceeded fine without it — which is how production ended
up with 24 payment rows marked ``fully_released`` and no Stripe charge behind
any of them.

What each trigger can actually do
---------------------------------
**ACCEPT is fully implemented here.** At accept a booking exists, a price is
agreed, and a ``payments`` row is created — so there is a real thing to charge
against. :func:`trigger_on_accept` creates the Stripe Checkout Session as part
of the accept response, so the client is handed a payment URL automatically
instead of being offered a button they may ignore.

**POST is structurally in place but cannot capture money yet, and this module
does not pretend otherwise.** At post time there is no business, no agreed
price (only a client-stated ``budget``), and no ``bookings`` row — and
``payments.booking_id`` is NOT NULL, so there is nowhere to record a charge.
Capturing at post requires card-on-file: a Stripe SetupIntent at post that
saves a payment method, then an off-session PaymentIntent at accept. That
infrastructure does not exist in this repo (it was attempted in PR #23, which
never landed). :func:`trigger_on_post` therefore runs the *enforceable* half —
it records the intent to charge and reports whether the client can actually be
charged — and is gated OFF by default until card-on-file exists. See
``CHARGE_AT_POST_ENABLED``.

The other half of charge-before-service
---------------------------------------
A trigger only asks for money. What makes it *enforcement* is that skipping it
now has a consequence: :func:`app.services.escrow.assert_capture_backed`
refuses to release escrow to a business unless a real capture (or a recorded
off-platform payment) exists. Trigger + guard together are the ruling; either
one alone is not.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from app.supabase_client import supabase

logger = logging.getLogger(__name__)


def _flag(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "off")


def charge_at_accept_enabled() -> bool:
    """Trigger 2 — charge when the client accepts a quote. ON by default.

    Set CHARGE_AT_ACCEPT=0 to fall back to the old manual-button behaviour.
    """
    return _flag("CHARGE_AT_ACCEPT", "1")


def charge_at_post_enabled() -> bool:
    """Trigger 1 — charge when the client posts a job. OFF by default.

    Stays off until card-on-file (SetupIntent at post → off-session
    PaymentIntent at accept) exists. See the module docstring; turning this on
    without card-on-file cannot capture money, it can only block posting.
    """
    return _flag("CHARGE_AT_POST", "0")


class ChargeTriggerResult(dict):
    """Result of a trigger. Dict-shaped so it drops straight into a response.

    Keys:
      ``triggered``  — bool, whether a charge was actually initiated
      ``reason``     — str, why not, when ``triggered`` is False
      ``checkout_url``/``checkout_session_id`` — present when triggered
    """


def trigger_on_accept(
    *,
    booking: dict,
    client: dict,
    post: Optional[dict] = None,
) -> ChargeTriggerResult:
    """TRIGGER 2 — charge the client the moment they accept a quote.

    Called from the quote-accept flow immediately after the booking and its
    ``payments`` row are created. Creates a Stripe Checkout Session for the
    agreed total and returns its URL so the accept response can send the client
    straight to payment.

    NEVER raises. Accepting a quote must not 500 because Stripe is unreachable
    or unconfigured — the booking is already created and the escrow guard will
    stop it settling unpaid. Failures are logged loudly and reported in the
    result so the caller can surface "payment could not be started".
    """
    if not charge_at_accept_enabled():
        return ChargeTriggerResult(triggered=False, reason="charge_at_accept_disabled")

    booking_id = booking.get("id")
    from app.services import escrow

    total_c = (
        int(booking["total_amount_cents"])
        if booking.get("total_amount_cents") is not None
        else escrow.to_cents(booking.get("total_amount"))
    )
    if total_c <= 0:
        return ChargeTriggerResult(triggered=False, reason="zero_amount")

    # Already paid? Never charge twice. This is also the idempotency guard for a
    # retried accept.
    payment = escrow.load_single_payment(booking_id) if booking_id else None
    if payment and escrow.is_capture_backed(payment):
        return ChargeTriggerResult(triggered=False, reason="already_paid")

    amount_c = total_c

    # Credit redemption, if enabled, reduces what Stripe is asked to charge.
    # Gated off (credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED) pending
    # live-Stripe verification — see items 14/15 in the money report.
    from app.services import credits

    if credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED:
        try:
            redemption = credits.redeem_credit_for_booking(
                user_id=client["id"],
                booking_id=booking_id,
                gross_amount_cents=total_c,
            )
            amount_c = int(redemption["net_amount_cents"])
        except Exception:
            logger.exception(
                "trigger_on_accept: credit redemption failed for booking %s — "
                "charging the gross amount",
                booking_id,
            )
            amount_c = total_c
        if amount_c <= 0:
            return ChargeTriggerResult(
                triggered=False, reason="fully_covered_by_credit"
            )

    category = (post or {}).get("category") or booking.get("service_category")
    description = f"SwingBy — {category or 'booking'} #{str(booking_id)[:8]}"

    try:
        from app.services import stripe_service

        session = stripe_service.create_checkout_session(
            booking_id=booking_id,
            amount_cad=escrow.to_dollars(amount_c),
            description=description,
            client_email=client.get("email"),
        )
    except Exception as exc:
        # Includes HTTPException(503) when Stripe is not configured — that is a
        # normal, expected state in local dev and the demo environment.
        logger.warning(
            "trigger_on_accept: could not start payment for booking %s: %s",
            booking_id,
            exc,
        )
        _record_event(
            booking_id,
            client.get("id"),
            "payment_requested_failed",
            f"Charge-at-accept could not start: {exc}",
        )
        return ChargeTriggerResult(triggered=False, reason=f"stripe_unavailable: {exc}")

    _record_event(
        booking_id,
        client.get("id"),
        "payment_requested",
        f"Charge-at-accept: {escrow.to_dollars(amount_c):.2f} CAD requested",
    )
    logger.info(
        "trigger_on_accept: checkout session %s created for booking %s (%d cents)",
        session.get("id"),
        booking_id,
        amount_c,
    )
    return ChargeTriggerResult(
        triggered=True,
        reason="charge_at_accept",
        checkout_url=session.get("url"),
        checkout_session_id=session.get("id"),
        amount_cents=amount_c,
    )


def trigger_on_post(*, post: dict, client: dict) -> ChargeTriggerResult:
    """TRIGGER 1 — charge the client the moment they post a job.

    **Not capable of capturing money in the current schema, and says so.**

    At post time:
      * no business has been matched, so no price is agreed — only the client's
        own ``budget``;
      * there is no ``bookings`` row, and ``payments.booking_id`` is NOT NULL,
        so a charge has nowhere to be recorded;
      * the client has no saved payment method, so nothing can be charged
        off-session.

    Closing this properly needs card-on-file: a Stripe SetupIntent at post that
    saves the client's card, then an off-session PaymentIntent at accept. Until
    that exists, this returns ``triggered=False`` with the reason, so the caller
    (and anyone reading the response) sees an honest "not charged" rather than a
    silent no-op that looks like success.
    """
    if not charge_at_post_enabled():
        return ChargeTriggerResult(
            triggered=False,
            reason="charge_at_post_disabled",
            detail=(
                "Charging at post requires card-on-file (Stripe SetupIntent at "
                "post, off-session PaymentIntent at accept). That infrastructure "
                "does not exist yet. Set CHARGE_AT_POST=1 only after it does."
            ),
        )

    budget_c = 0
    from app.services import escrow

    if post.get("budget") is not None:
        budget_c = escrow.to_cents(post.get("budget"))

    logger.warning(
        "trigger_on_post: CHARGE_AT_POST is on but no card-on-file mechanism "
        "exists — post %s by client %s for %d cents was NOT charged.",
        post.get("id"),
        client.get("id"),
        budget_c,
    )
    return ChargeTriggerResult(
        triggered=False,
        reason="no_card_on_file_mechanism",
        amount_cents=budget_c,
        detail=(
            "No saved payment method and no bookings row to charge against. "
            "Implement Stripe SetupIntent card-on-file before enabling this."
        ),
    )


def _record_event(
    booking_id: Optional[str],
    actor_id: Optional[str],
    event_type: str,
    note: str,
) -> None:
    """Append a booking_events row. Best-effort; never raises."""
    if not booking_id:
        return
    try:
        supabase.table("booking_events").insert(
            {
                "booking_id": booking_id,
                "actor_id": actor_id,
                "event_type": event_type,
                "note": note[:500],
            }
        ).execute()
    except Exception:
        logger.debug(
            "payment_triggers: could not record booking_event %s for %s",
            event_type,
            booking_id,
        )
