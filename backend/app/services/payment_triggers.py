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

**POST does not capture money, and the reason is now a RUNTIME FACT rather
than a belief.** This distinction is the whole point of the 2026-08-22 rewrite
and is worth stating plainly, because the previous version of this docstring
was wrong for roughly a month.

It used to claim that capturing at post requires card-on-file which the repo
lacked, and that ``payments.booking_id`` is NOT NULL so there is nowhere to
record a charge. **Both statements are false today** (they are paraphrased
rather than quoted here on purpose — ``test_the_retired_claims_never_come_back``
greps this file for the original wording):

* Card-on-file landed (DEC-4, PR #83). ``POST /payments/stripe/setup-intent``,
  ``GET /payments/stripe/payment-methods``, ``users.default_payment_method_id``
  and ``mobile/src/services/cards.js`` are all live, with a reachable screen at
  ``PaymentMethodScreen.js``.
* Migration ``20260727000000_charge_at_post.sql`` ran
  ``alter column booking_id drop not null`` and added ``payments.post_id`` with
  an index. It is applied — ``post_id`` is queryable on the live project.

Nothing re-evaluated the refusal when its preconditions were satisfied, because
the refusal was a comment and a ``return`` rather than a check. So an entire
built, tested and live downstream — ``refunds.load_post_payment``,
``budget_settlement.settle_on_accept``, ``expiry_sweep.sweep_once``,
``payments.post_id`` — sat with its only producer switched off by a stale
belief, and the user-facing Terms went on describing a charge the backend
structurally refused to make.

:func:`trigger_on_post` now *looks*: it asks whether this client actually has a
saved card and reports what it finds. The remaining gap is honest and narrow —
**no off-session capture call is implemented yet** — and it is reported as
``capture_not_implemented`` at runtime instead of being asserted as missing
infrastructure. See :func:`charge_at_post_enabled` for why the flag is still
off by default.

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

    It is off for THREE reasons, and only the third is still technical:

    1. **Product/legal.** Charging before a price is agreed — against a
       client-stated budget, with no business matched — is a decision for the
       product owner, not a default. It also has to match the Terms.
    2. **The refund safety net is scheduler-shaped.** The live pg_cron job
       ``expire-service-posts`` only flips ``status``; it moves no money.
       ``expiry_sweep`` does refund, but it runs lazily on read. While nothing
       is charged at post, ``escrow_held`` is always 0 and that is harmless.
       The day this flag goes on, a client's money would sit against an expired
       post until somebody happened to open a screen. **Close that first.**
    3. **No off-session capture is implemented.** :func:`trigger_on_post` now
       verifies the card at runtime, but nothing calls
       ``stripe.PaymentIntent.create(confirm=True, off_session=True)`` yet.

    What is NO LONGER a reason: "card-on-file does not exist" and
    "payments.booking_id is NOT NULL". Both were true once and neither is now —
    see the module docstring. Do not re-add them here.
    """
    return _flag("CHARGE_AT_POST", "0")


def saved_card_id(user_id: str) -> Optional[str]:
    """The client's default saved card, or None. A QUESTION, not an assumption.

    This function exists so that "can we charge this client off-session?" is
    answered by looking, every time. The bug it replaces was a hard-coded
    ``return triggered=False`` that could not notice card-on-file shipping.
    """
    if not user_id:
        return None
    try:
        from app.services import stripe_payment_sheet

        return stripe_payment_sheet._default_payment_method_id(user_id)
    except Exception:
        logger.warning("saved-card lookup failed for user %s", user_id, exc_info=True)
        return None


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

    # How much of this booking is already paid for? Normally none — the payments
    # row was created moments ago and nothing has been captured.
    #
    # But a Post + Pay client had their whole BUDGET captured at posting, and
    # interests.py binds that row to this booking at accept. If the quote they
    # accepted came in ABOVE that budget, the difference is still owed, and
    # bailing out with "already_paid" would hand the business a job the client
    # only partly paid for. Kira's ruling (2026-07-28): charge that delta here,
    # at accept.
    #
    # Only CAPTURE-BACKED money counts as paid. `total_charged` on its own will
    # not do: the Flow B row carries the full amount as *owed* from the moment
    # it is inserted, before a cent has moved, so reading that as "paid" would
    # charge nothing and leave every ordinary booking unpaid.
    payment = escrow.load_single_payment(booking_id) if booking_id else None
    already_paid_c = 0
    outstanding_c = total_c

    if payment and escrow.is_capture_backed(payment):
        already_paid_c = max(
            escrow.money_cents(payment, "total_charged")
            - escrow.money_cents(payment, "refunded"),
            0,
        )
        outstanding_c = max(total_c - already_paid_c, 0)

        if outstanding_c == 0:
            # Covered in full — a retried accept, or a quote at/under budget
            # whose unused remainder has already gone back.
            return ChargeTriggerResult(triggered=False, reason="already_paid")

        if already_paid_c == 0:
            # Capture-backed, but the row records no amount, so the shortfall
            # cannot be computed. Charging the full total against a row that
            # says money already arrived is exactly how a client who has paid
            # gets billed a second time. Under-charge and let it be reconciled
            # rather than guess — the guard exists for this.
            logger.warning(
                "trigger_on_accept: booking %s has a capture-backed payment row "
                "with no recorded amount — not charging. Needs reconciliation.",
                booking_id,
            )
            return ChargeTriggerResult(triggered=False, reason="already_paid")

    amount_c = outstanding_c

    # Credit redemption, if enabled, reduces what Stripe is asked to charge.
    # Gated off (credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED) pending
    # live-Stripe verification — see items 14/15 in the money report.
    from app.services import credits

    if credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED:
        try:
            redemption = credits.redeem_credit_for_booking(
                user_id=client["id"],
                booking_id=booking_id,
                # Credit comes off what is still OWED, not off the headline
                # total — otherwise a part-paid booking would redeem against
                # money the client has already handed over.
                gross_amount_cents=outstanding_c,
            )
            amount_c = int(redemption["net_amount_cents"])
        except Exception:
            logger.exception(
                "trigger_on_accept: credit redemption failed for booking %s — "
                "charging the gross amount",
                booking_id,
            )
            amount_c = outstanding_c
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
        # Distinguished so the ledger's story is legible after the fact: a
        # top-up is the client's SECOND charge for one job, and reading it as a
        # first charge is how double-billing hides.
        reason="charge_at_accept_delta" if already_paid_c else "charge_at_accept",
        checkout_url=session.get("url"),
        checkout_session_id=session.get("id"),
        amount_cents=amount_c,
        already_paid_cents=already_paid_c,
    )


def trigger_on_post(*, post: dict, client: dict) -> ChargeTriggerResult:
    """TRIGGER 1 — charge the client the moment they post a job.

    **Still does not capture money — but it now finds that out by looking.**

    The previous version returned ``triggered=False`` unconditionally, with a
    ``detail`` asserting that card-on-file and a nullable ``payments.booking_id``
    did not exist. Both had shipped. Because the refusal was hard-coded rather
    than checked, ``CHARGE_AT_POST=1`` was a phantom switch: turning it on
    changed nothing except emitting a warning, and no test could fail when the
    stated blockers were removed.

    Every ``reason`` below is now a fact established at call time:

    ``charge_at_post_disabled``   the flag is off (the default; see
                                  :func:`charge_at_post_enabled`)
    ``no_card_on_file``           this client has no saved payment method —
                                  a real per-client answer, not a claim about
                                  the repo
    ``capture_not_implemented``   the client CAN be charged and we are not yet
                                  doing it. This is the honest remaining gap,
                                  and it is loud on purpose.
    """
    if not charge_at_post_enabled():
        return ChargeTriggerResult(
            triggered=False,
            reason="charge_at_post_disabled",
            detail=(
                "Charge-at-post is switched off. This is a product decision "
                "plus one open technical item (off-session capture), NOT "
                "missing card-on-file — see charge_at_post_enabled()."
            ),
        )

    from app.services import escrow

    budget_c = (
        escrow.to_cents(post.get("budget")) if post.get("budget") is not None else 0
    )
    client_id = client.get("id")
    card_id = saved_card_id(client_id)

    if not card_id:
        # A per-client fact. This client can add a card on PaymentMethodScreen
        # and the answer changes — which is exactly what the old hard-coded
        # refusal could never express.
        return ChargeTriggerResult(
            triggered=False,
            reason="no_card_on_file",
            amount_cents=budget_c,
            detail=(
                "This client has no saved payment method. They can add one in "
                "Profile → Payment methods; the charge can then be taken "
                "off-session."
            ),
        )

    # The client IS chargeable. Refusing here is a gap in OUR implementation,
    # and it must not be reported as though the client or the platform were
    # missing something.
    logger.error(
        "trigger_on_post: CHARGE_AT_POST is on and client %s HAS a saved card "
        "(%s), but off-session capture is not implemented — post %s for %d "
        "cents was NOT charged. Implement the capture or turn the flag off.",
        client_id,
        card_id,
        post.get("id"),
        budget_c,
    )
    return ChargeTriggerResult(
        triggered=False,
        reason="capture_not_implemented",
        amount_cents=budget_c,
        detail=(
            "The client has a saved card and the schema can record a post-bound "
            "charge (payments.post_id, booking_id nullable). What is missing is "
            "the off-session PaymentIntent call itself. Do not enable this flag "
            "in production until that exists AND the expiry refund sweep is "
            "driven by something other than a page view."
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
        # Was logger.debug, which is off in production — so these writes
        # violated the event_type CHECK from the day they shipped and left no
        # trace anywhere. Still best-effort (a timeline row must never fail a
        # charge), now at a level somebody sees.
        logger.exception(
            "payment_triggers: could not record booking_event %s for %s",
            event_type,
            booking_id,
        )
