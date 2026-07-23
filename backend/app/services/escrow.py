"""
escrow.py — Ledger state machine for booking payments.

Money model (product-owner ruling, 2026-07-21): **charge BEFORE service**.
Money is NEVER marked ``released_to_business`` before the work is done and, for
on-platform (Stripe) payments, before capture is confirmed by Stripe.

Ledger states (``payments.status`` — CHECK-constrained in the DB):

  pending            booking accepted; amount owed; nothing captured, nothing
                     released to the business yet.
  partial            legacy on-platform partial state (kept for back-compat).
  paid_full          Stripe capture confirmed — full amount held in escrow.
  paid_off_platform  paid in cash / e-transfer off SwingBy — no escrow, no cut.
  fully_released     escrow released to the business on completion (minus cut).
  refunded           booking cancelled — ledger split per the penalty.
  failed             capture failed / amount mismatch — needs manual review.

All money math in this module uses integer cents via ``Decimal`` so we never add
float drift in the money paths this module owns. Amounts are handed back as
float dollars to match the existing ``double precision`` columns.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.supabase_client import supabase

logger = logging.getLogger(__name__)

# Statuses that mean "escrow has already been released / settled" — completion
# and off-platform marking must treat these as terminal.
RELEASED_OR_SETTLED = ("fully_released", "paid_off_platform", "refunded")
# Statuses that mean money is still held awaiting release to the business.
# Spans BOTH vocabularies on purpose. Migration 0001 (applied 2026-07-22)
# renamed pending->pending_payment, partial->partial_released, paid_full->held,
# but a read filter that only knows one side silently under-counts: before the
# migration it would miss the new names, after it, the old ones. Environments
# migrate at different times, so accept both and let the write paths emit only
# the new vocabulary.
HELD_NOT_RELEASED = (
    # legacy (pre-0001)
    "pending",
    "partial",
    "paid_full",
    # current
    "pending_payment",
    "partial_released",
    "held",
)


class EscrowError(RuntimeError):
    """Raised when the ledger is in a state completion/cancel cannot safely act on."""


def to_cents(x) -> int:
    """Dollars (float/str/None) → integer cents, half-up rounded."""
    return int(
        (Decimal(str(x or 0)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


def to_dollars(cents: int) -> float:
    """Integer cents → float dollars."""
    return float(Decimal(cents) / 100)


PLATFORM_RATE = Decimal("0.10")  # SwingBy keeps 10% of the booking total.


def platform_cut(total_amount) -> float:
    """Platform's 10% cut of a booking total, in dollars (cents-based)."""
    cut_c = int(
        (Decimal(to_cents(total_amount)) * PLATFORM_RATE).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )
    return to_dollars(cut_c)


def compute_completion_release(
    total_charged, platform_cut, released_to_business
) -> dict:
    """Cents-based math for the completion release.

    Business is owed the full charge minus the platform cut. Whatever has not
    already been released is released now. Returns dollar amounts for the
    payments row update.
    """
    total_c = to_cents(total_charged)
    cut_c = to_cents(platform_cut)
    already_c = to_cents(released_to_business)
    target_c = total_c - cut_c  # what the business should end up with
    final_release_c = max(target_c - already_c, 0)
    return {
        "released_to_business": to_dollars(already_c + final_release_c),
        "escrow_held": 0,
        "final_release": to_dollars(final_release_c),
        "platform_cut": to_dollars(cut_c),
    }


# ── Cancellation penalty ladder (published ToS, product-owner ruling 2026-07-21)
#
# 48h is measured against ``bookings.confirmed_date``. "no_show" = a cancel filed
# after the confirmed date/time has already passed (the party never showed).
#
#   CLIENT cancels
#     early   (>48h)   client refunded 100%, business receives   0%
#     late    (<=48h)  client refunded  75%, business receives  25%
#     no_show          client refunded  50%, business receives  50%
#
#   BUSINESS cancels
#     early   (>48h)   client refunded 100%, business penalty  0,   no credit
#     late    (<=48h)  client refunded 100%, business penalty 25%, + client credit
#     no_show          client refunded 100%, business penalty 50%, + client credit
#
#   no_date (either actor, no confirmed date yet) → 0 penalty, no credit.
#
# The business "penalty" is an audit/ledger figure recorded on
# ``cancellations.penalty_amount``: in the charge-before-service model the
# business has been paid nothing before completion, so there is no captured
# payout to claw back — the client is simply made whole and (for late/no-show)
# handed a goodwill credit. See app.services.credits.GOODWILL_CREDIT_CENTS.

_CANCEL_ACTORS = ("client", "business")
_CANCEL_TIMINGS = ("no_date", "early", "late", "no_show")


def classify_cancellation_timing(confirmed_date, now: Optional[datetime] = None) -> str:
    """Bucket a cancellation by proximity to ``confirmed_date``.

    Returns one of: ``no_date`` (no/unparseable confirmed date), ``early``
    (>48h before), ``late`` (0–48h before), ``no_show`` (date already passed).
    Pure/deterministic given ``now`` so it is unit-testable.
    """
    if not confirmed_date:
        return "no_date"
    now = now or datetime.now(timezone.utc)
    try:
        job_dt = datetime.fromisoformat(str(confirmed_date).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return "no_date"
    hours_until = (job_dt - now).total_seconds() / 3600
    if hours_until < 0:
        return "no_show"
    if hours_until <= 48:
        return "late"
    return "early"


def _pct_cents(total_c: int, pct: int) -> int:
    """``pct`` percent of ``total_c`` cents, half-up rounded."""
    return int(
        (Decimal(total_c) * Decimal(pct) / Decimal(100)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )


def compute_cancellation_split(total_amount, actor: str, timing: str) -> dict:
    """Pure cents-based split of a cancelled booking per the ToS ladder.

    ``actor``  — "client" or "business" (who cancelled).
    ``timing`` — one of classify_cancellation_timing()'s buckets.

    Returns a dict of both cents and dollar figures:
      client_refund          — dollars refunded to the client
      business_keeps         — dollars the business retains/receives (ledger
                               ``released_to_business`` on cancel)
      business_penalty       — dollars the business is penalised (audit only)
      credit_amount          — goodwill credit granted to the client (dollars)
      penalty_amount         — figure to record on cancellations.penalty_amount
                               (= business_keeps for a client cancel, the
                               business_penalty for a business cancel)
      *_cents                — integer-cents counterparts
    """
    if actor not in _CANCEL_ACTORS:
        raise ValueError(f"actor must be one of {_CANCEL_ACTORS}, got {actor!r}")
    if timing not in _CANCEL_TIMINGS:
        raise ValueError(f"timing must be one of {_CANCEL_TIMINGS}, got {timing!r}")

    # Local import avoids a module cycle (credits imports nothing from escrow,
    # but keep the dependency direction explicit and lazy).
    from app.services.credits import GOODWILL_CREDIT_CENTS

    total_c = to_cents(total_amount)
    client_refund_c = total_c
    business_keeps_c = 0
    business_penalty_c = 0
    credit_c = 0

    if timing == "no_date":
        # No confirmed date yet → no penalty either way, client fully refunded.
        client_refund_c = total_c
    elif actor == "client":
        if timing == "early":
            client_refund_c = total_c  # 100%
        elif timing == "late":
            business_keeps_c = _pct_cents(total_c, 25)
            client_refund_c = total_c - business_keeps_c  # 75%
        elif timing == "no_show":
            business_keeps_c = _pct_cents(total_c, 50)
            client_refund_c = total_c - business_keeps_c  # 50%
    else:  # actor == "business" — client is always made whole
        client_refund_c = total_c  # 100%
        if timing == "late":
            business_penalty_c = _pct_cents(total_c, 25)
            credit_c = GOODWILL_CREDIT_CENTS
        elif timing == "no_show":
            business_penalty_c = _pct_cents(total_c, 50)
            credit_c = GOODWILL_CREDIT_CENTS
        # early → no penalty, no credit.

    penalty_c = business_keeps_c if actor == "client" else business_penalty_c
    return {
        "client_refund": to_dollars(client_refund_c),
        "business_keeps": to_dollars(business_keeps_c),
        "business_penalty": to_dollars(business_penalty_c),
        "credit_amount": to_dollars(credit_c),
        "penalty_amount": to_dollars(penalty_c),
        "client_refund_cents": client_refund_c,
        "business_keeps_cents": business_keeps_c,
        "business_penalty_cents": business_penalty_c,
        "credit_cents": credit_c,
        "penalty_cents": penalty_c,
    }


def load_single_payment(booking_id: str) -> Optional[dict]:
    """Return the single payments row for a booking, or None.

    The whole codebase assumes exactly one payments row per booking
    (payments.py and bookings.py both use ``.single()``). This helper never
    raises on 'not found' so callers can decide how to handle a missing row.
    """
    try:
        res = (
            supabase.table("payments")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        return res.data
    except Exception:
        return None


def release_escrow_on_complete(booking_id: str) -> dict:
    """Release the on-platform escrow for a completed booking.

    Shared by ``PATCH /bookings/{id}/complete`` and admin force-complete so both
    move the ledger identically. Does NOT touch the ``bookings`` row — the caller
    owns that (their status transitions differ).

    Returns a summary dict: {"outcome": ..., "payment": <updated row or None>}.

    Raises ``EscrowError`` if there is no payments row (fix F: never mark a
    non-existent payment released).
    """
    payment = load_single_payment(booking_id)
    if not payment:
        raise EscrowError(f"No payments row for booking {booking_id}")

    status = payment.get("status")

    if status == "paid_off_platform":
        # Paid in cash/e-transfer — money never touched the platform. Nothing to
        # release; the booking simply completes.
        return {"outcome": "offplatform", "payment": payment}

    if status == "fully_released":
        # Idempotent: already released (e.g. retry after a partial failure).
        return {"outcome": "already_released", "payment": payment}

    if status == "refunded":
        raise EscrowError(
            f"Booking {booking_id} payment is refunded — cannot release on complete"
        )

    # pending / partial / paid_full → release the full net to the business now.
    release = compute_completion_release(
        payment.get("total_charged"),
        payment.get("platform_cut"),
        payment.get("released_to_business"),
    )
    upd = (
        supabase.table("payments")
        .update(
            {
                "released_to_business": release["released_to_business"],
                "escrow_held": 0,
                "status": "fully_released",
                "released_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", payment["id"])
        .execute()
    )
    updated = (upd.data or [payment])[0]
    return {"outcome": "released", "payment": updated, "release": release}
