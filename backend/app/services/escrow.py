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
HELD_NOT_RELEASED = ("pending", "partial", "paid_full")


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


def compute_cancellation_split(
    total_amount, penalty_amount, cancelled_by_business: bool
) -> dict:
    """Cents-based split of a cancelled booking.

    - Client-initiated cancel: the business keeps the penalty; the client is
      refunded the remainder.
    - Business-initiated cancel: the client is made whole (full refund); the
      business keeps nothing. (A business that cancels does not get to keep a
      client's money. Any business-side penalty is a future ledger item — see
      PR notes — and is intentionally NOT charged here.)
    """
    total_c = to_cents(total_amount)
    if cancelled_by_business:
        business_keeps_c = 0
    else:
        business_keeps_c = min(to_cents(penalty_amount), total_c)
    client_refund_c = total_c - business_keeps_c
    return {
        "business_keeps": to_dollars(business_keeps_c),
        "client_refund": to_dollars(client_refund_c),
        "business_keeps_cents": business_keeps_c,
        "client_refund_cents": client_refund_c,
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
