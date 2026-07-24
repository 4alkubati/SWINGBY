"""
escrow.py — Ledger state machine for booking payments.

Money model (product-owner ruling, 2026-07-21): **charge BEFORE service**.
Money is NEVER marked ``released_to_business`` before the work is done and,
for on-platform bookings, before Stripe has actually captured the charge.

Ledger states (``payments.status`` — CHECK-constrained in the DB):

  pending_payment    booking accepted; amount owed; nothing captured, nothing
                     released to the business yet.
  partial_released   legacy partial state (kept for back-compat).
  held               Stripe capture confirmed — full amount held in escrow.
  paid_off_platform  paid in cash / e-transfer off SwingBy — no escrow, no cut.
  fully_released     escrow released to the business on completion (minus cut).
  refunded           booking cancelled — ledger split per the penalty.
  failed             capture failed / amount mismatch — needs manual review.

The legacy vocabulary (pending / partial / paid_full) is still accepted by the
live CHECK constraint and still present on old rows, so read filters span both.

MONEY REPRESENTATION
--------------------
Integer cents are authoritative. Migration
``20260723120000_money_integer_cents_and_ledger_integrity.sql`` added
``payments.{total_charged,escrow_held,released_to_business,platform_cut}_cents``
(bigint, NOT NULL) alongside the legacy ``double precision`` dollar columns, and
a BEFORE INSERT/UPDATE trigger that keeps the two in lockstep — cents win when
both change. Every read in this module goes through :func:`money_cents` (cents
column first, dollar column only as a fallback for a row written before the
migration); every write goes through :func:`ledger_write` which emits BOTH
representations from one integer-cents source of truth.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.supabase_client import supabase

logger = logging.getLogger(__name__)

# Statuses that mean "escrow has already been released / settled" — completion
# and off-platform marking must treat these as terminal.
RELEASED_OR_SETTLED = ("fully_released", "paid_off_platform", "refunded")

# Statuses that mean money is still held awaiting release to the business.
# Spans BOTH vocabularies on purpose: the live payments_status_check accepts
# pending/partial/paid_full AND pending_payment/partial_released/held, and rows
# in both vocabularies exist in production today (verified 2026-07-23). A read
# filter that knows only one side silently under-counts.
#
# NOTE: earlier comments in this file and in interests.py / payments_stripe.py
# justified the dual vocabulary by citing "migration 0001, applied 2026-07-22".
# **There is no such migration** — it is in neither the repo nor the live
# migration list. The dual vocabulary is real and necessary; the stated reason
# was not. Verified against the live CHECK constraint, not the narrative.
HELD_NOT_RELEASED = (
    # legacy
    "pending",
    "partial",
    "paid_full",
    # current
    "pending_payment",
    "partial_released",
    "held",
)

# Statuses that mean an on-platform capture has been CONFIRMED — real money is
# sitting in escrow. Anything outside this set has not been paid for.
CAPTURED_ON_PLATFORM = ("paid_full", "held", "partial", "partial_released")

# Off-platform payment methods. Money changed hands outside SwingBy, so there is
# no Stripe charge to point at and no escrow to release.
OFF_PLATFORM_METHODS = ("cash", "e_transfer", "other")


class EscrowError(RuntimeError):
    """Raised when the ledger is in a state completion/cancel cannot safely act on."""


class CaptureRequiredError(EscrowError):
    """Raised when a release is attempted against money that was never captured.

    FINDING C (money audit, 2026-07-23). Completing a job used to release the
    full net to the business with no check that a charge ever happened — proven
    live by releasing $180 against a booking that had no Stripe charge. 24 of 29
    payment rows in production read ``fully_released`` with a NULL
    ``stripe_payment_intent_id`` behind them, $4,675.50 of payouts nobody paid.
    """


# ---------------------------------------------------------------------------
# Cents / dollars conversion
# ---------------------------------------------------------------------------


def to_cents(x) -> int:
    """Dollars (float/str/Decimal/None) → integer cents, half-up rounded."""
    return int(
        (Decimal(str(x or 0)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )


def to_dollars(cents: int) -> float:
    """Integer cents → float dollars (for the legacy double precision mirror)."""
    return float(Decimal(int(cents)) / 100)


PLATFORM_RATE = Decimal("0.10")  # SwingBy keeps 10% of the booking total.

# Map each dollar column to its authoritative cents column.
_MONEY_COLUMNS = {
    "total_charged": "total_charged_cents",
    "escrow_held": "escrow_held_cents",
    "released_to_business": "released_to_business_cents",
    "platform_cut": "platform_cut_cents",
}


def money_cents(row: Optional[dict], field: str) -> int:
    """Read a money field off a payments row as integer cents.

    ``field`` is the DOLLAR column name (e.g. ``"total_charged"``). The
    authoritative ``*_cents`` column is preferred; the float dollar column is
    only used as a fallback for rows written before the cents migration, or for
    a partial ``.select()`` that did not ask for the cents column.
    """
    if not row:
        return 0
    cents_col = _MONEY_COLUMNS.get(field, f"{field}_cents")
    if row.get(cents_col) is not None:
        return int(row[cents_col])
    return to_cents(row.get(field))


def ledger_write(**cents_fields: int) -> dict:
    """Build a payments UPDATE/INSERT payload from integer-cents values.

    Emits BOTH the authoritative ``*_cents`` column and the legacy dollar
    mirror from the same integer, so a reader on either representation sees the
    identical number even if the DB sync trigger is absent (e.g. a local
    Postgres that has not run the migration, or the mocked DB in the tests).

    >>> ledger_write(escrow_held=15000, released_to_business=0)
    {'escrow_held_cents': 15000, 'escrow_held': 150.0,
     'released_to_business_cents': 0, 'released_to_business': 0.0}
    """
    out: dict = {}
    for field, cents in cents_fields.items():
        if field not in _MONEY_COLUMNS:
            raise ValueError(f"{field!r} is not a payments money column")
        c = int(cents)
        out[_MONEY_COLUMNS[field]] = c
        out[field] = to_dollars(c)
    return out


def platform_cut_cents(total_cents: int) -> int:
    """Platform's 10% cut of a booking total, in integer cents."""
    return int(
        (Decimal(int(total_cents)) * PLATFORM_RATE).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )


def platform_cut(total_amount) -> float:
    """Platform's 10% cut of a booking total, in dollars (cents-based)."""
    return to_dollars(platform_cut_cents(to_cents(total_amount)))


# ---------------------------------------------------------------------------
# Capture verification — FINDING C
# ---------------------------------------------------------------------------


# Escape hatch for environments that deliberately run without Stripe (the
# investor-demo seed, local dev, the e2e smoke test). Default is ON: a release
# requires a real capture. Set PAYMENT_REQUIRE_CAPTURE=0 to fall back to the old
# permissive behaviour — every bypass is logged at WARNING with the amount, so a
# demo environment leaves an audit trail rather than a silent hole.
def require_capture_enabled() -> bool:
    """True unless PAYMENT_REQUIRE_CAPTURE is explicitly falsey in the env."""
    return os.getenv("PAYMENT_REQUIRE_CAPTURE", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def is_capture_backed(payment: dict) -> bool:
    """True if this payments row is backed by money that actually arrived.

    Two ways money can genuinely be in hand:

    1. **Off-platform** — ``status='paid_off_platform'`` or an off-platform
       ``method`` (cash / e-transfer / other). The client paid the business
       directly; SwingBy holds nothing and releases nothing.
    2. **On-platform capture confirmed** — the status says escrow is held AND
       ``stripe_payment_intent_id`` names the Stripe charge behind it.

    A row that merely *says* ``held`` with no PaymentIntent is not capture
    backed. That combination is exactly what the accept-time insert produces
    before anybody pays, and treating it as paid is FINDING C.
    """
    if not payment:
        return False
    if payment.get("status") == "paid_off_platform":
        return True
    if (payment.get("method") or "") in OFF_PLATFORM_METHODS:
        return True
    if payment.get("status") not in CAPTURED_ON_PLATFORM:
        return False
    return bool(payment.get("stripe_payment_intent_id"))


def assert_capture_backed(payment: dict, *, action: str = "release") -> None:
    """Raise :class:`CaptureRequiredError` unless real money is in hand.

    This is the guard FINDING C asked for. It sits in the service, not the
    route, so both ``PATCH /bookings/{id}/complete`` and the admin
    force-complete path inherit it without either endpoint changing.
    """
    if is_capture_backed(payment):
        return

    booking_id = (payment or {}).get("booking_id")
    amount = money_cents(payment, "total_charged")
    if not require_capture_enabled():
        logger.warning(
            "CAPTURE GUARD BYPASSED (PAYMENT_REQUIRE_CAPTURE=0): %s on booking %s "
            "for %d cents with status=%r and no Stripe PaymentIntent. This booking "
            "is being settled against money that was never collected.",
            action,
            booking_id,
            amount,
            (payment or {}).get("status"),
        )
        return

    raise CaptureRequiredError(
        f"Cannot {action} booking {booking_id}: no captured payment. "
        f"status={(payment or {}).get('status')!r}, "
        f"stripe_payment_intent_id is not set, method="
        f"{(payment or {}).get('method')!r}. Charge the client (or record an "
        f"off-platform payment) before releasing money to the business."
    )


# ---------------------------------------------------------------------------
# Completion release — cents-native
# ---------------------------------------------------------------------------


def compute_completion_release(
    total_charged, platform_cut, released_to_business
) -> dict:
    """Cents-based math for the completion release (dollar-arg back-compat form).

    Business is owed the full charge minus the platform cut. Whatever has not
    already been released is released now.
    """
    return compute_completion_release_cents(
        to_cents(total_charged), to_cents(platform_cut), to_cents(released_to_business)
    )


def compute_completion_release_cents(total_c: int, cut_c: int, already_c: int) -> dict:
    """Integer-cents completion release. Never releases more than was charged."""
    total_c, cut_c, already_c = int(total_c), int(cut_c), int(already_c)
    target_c = max(total_c - cut_c, 0)  # what the business should end up with
    final_release_c = max(target_c - already_c, 0)
    released_c = already_c + final_release_c
    return {
        "released_to_business_cents": released_c,
        "escrow_held_cents": 0,
        "final_release_cents": final_release_c,
        "platform_cut_cents": cut_c,
        # dollar mirrors, for callers/tests that still speak dollars
        "released_to_business": to_dollars(released_c),
        "escrow_held": 0,
        "final_release": to_dollars(final_release_c),
        "platform_cut": to_dollars(cut_c),
    }


# ---------------------------------------------------------------------------
# Capture hold — FINDING D
# ---------------------------------------------------------------------------


def compute_capture_hold(
    total_charged_cents: int, released_to_business_cents: int
) -> dict:
    """How much is held in escrow once Stripe confirms a capture.

    FINDING D (money audit, 2026-07-23). The webhook used to write
    ``escrow_held = total_charged`` flat, ignoring anything already released.
    Booking 82b69fc2 took one real $150 charge and the ledger ended up claiming
    $150 held AND $75 released — $225 of accounting against $150 of money.

    Escrow holds what is left of the charge after whatever has already gone out:
    ``held = max(total - already_released, 0)``. That keeps the invariant
    ``escrow_held + released_to_business <= total_charged``, which is now also a
    DB CHECK (``payments_ledger_not_over_charged``).
    """
    total_c = int(total_charged_cents or 0)
    already_c = int(released_to_business_cents or 0)
    held_c = max(total_c - already_c, 0)
    return {
        "escrow_held_cents": held_c,
        "released_to_business_cents": already_c,
        "escrow_held": to_dollars(held_c),
        "total_charged_cents": total_c,
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
    (payments.py and bookings.py both use ``.single()``). As of migration
    20260723120000 that assumption is enforced by a UNIQUE(booking_id)
    constraint — before it, nothing stopped a second row from silently 500ing
    every reader. This helper never raises on 'not found' so callers can decide
    how to handle a missing row.
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

    Raises:
      ``EscrowError``          — no payments row, or the row is refunded.
      ``CaptureRequiredError`` — FINDING C: the money was never collected. A
                                 subclass of EscrowError, so existing callers
                                 that catch EscrowError (bookings.py returns
                                 409) keep working unchanged.
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

    # ── FINDING C guard ───────────────────────────────────────────────────────
    # Before this line, ANY non-terminal status released the full net to the
    # business — including 'pending_payment' with no charge behind it. That is
    # how 24 rows and $4,675.50 of payouts came to exist with no PaymentIntent.
    payment.setdefault("booking_id", booking_id)
    assert_capture_backed(payment, action="release escrow for")

    total_c = money_cents(payment, "total_charged")
    cut_c = money_cents(payment, "platform_cut")
    already_c = money_cents(payment, "released_to_business")
    release = compute_completion_release_cents(total_c, cut_c, already_c)

    update = ledger_write(
        released_to_business=release["released_to_business_cents"],
        escrow_held=0,
    )
    update["status"] = "fully_released"
    update["released_at"] = datetime.now(timezone.utc).isoformat()

    upd = supabase.table("payments").update(update).eq("id", payment["id"]).execute()
    updated = (upd.data or [payment])[0]
    logger.info(
        "escrow released for booking %s: %d cents to the business "
        "(platform cut %d cents, intent=%s)",
        booking_id,
        release["final_release_cents"],
        cut_c,
        payment.get("stripe_payment_intent_id"),
    )
    return {"outcome": "released", "payment": updated, "release": release}
