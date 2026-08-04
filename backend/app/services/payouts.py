"""
payouts.py — what a business is allowed to take out, and what it has taken.

D5. This module owns the BALANCE, not the money movement — the Stripe calls
live in ``app.services.stripe_connect`` and the endpoints in
``app.api.payouts``. It invents no money rules: the amount a business has earned
is whatever ``app.services.escrow`` already released to it, and this file only
subtracts what has already been sent.

THE ONE EQUATION
----------------
::

    available = earned_cents - paid_out_cents

where

``earned_cents``
    the sum of ``payments.released_to_business_cents`` over this business's
    bookings, **counting capture-backed rows only**.

``paid_out_cents``
    the sum of ``payouts.amount_cents`` for every row whose Stripe TRANSFER
    succeeded.

WHY "CAPTURE-BACKED ONLY" IS THE WHOLE BALLGAME
-----------------------------------------------
FINDING C (money audit 2026-07-23): 24 of 29 production payment rows read
``fully_released`` with a NULL ``stripe_payment_intent_id`` behind them —
**$4,675.50 of releases nobody ever paid for**. Those rows are legacy data and
are deliberately not rewritten (see ``app/api/payments.py``), which was
harmless while ``released_to_business`` was only ever displayed.

It stops being harmless the moment there is a cash-out button. Summing
``released_to_business`` naively would offer a business several thousand dollars
of balance that no client's card ever funded, and paying it would move real
platform money against a phantom ledger row. So the earned side runs through
:func:`escrow.is_capture_backed` — the same predicate ``GET /payments/mine``
already uses for its ``verified_released`` figure — and phantom rows contribute
zero.

WHY THE TRANSFER, NOT THE STATUS, MARKS MONEY AS SPENT
-------------------------------------------------------
A cash-out is two Stripe calls (transfer to the connected account, then payout
off it). The transfer is the instant the money stops being SwingBy's. So a
payout row that died BEFORE its transfer must not reduce the balance — nothing
left — and one that died AFTER it must, because the funds are sitting on the
business's connected account. Keying on ``stripe_transfer_id`` gets both right;
keying on ``status`` gets the second one wrong and hands out the same money
twice.
"""

from __future__ import annotations

import logging
from typing import Any, Iterable

from app.services import escrow

logger = logging.getLogger(__name__)

# Payout rows in these states may still move at Stripe, so a read should
# re-check them. Anything else is terminal and is never re-fetched.
UNSETTLED_STATUSES = ("pending", "in_transit")

# Stripe payout statuses we store verbatim. Kept as a tuple so the API layer and
# the DB CHECK constraint cannot drift apart silently.
PAYOUT_STATUSES = ("pending", "in_transit", "paid", "failed", "canceled")


def earned_cents(payment_rows: Iterable[dict]) -> int:
    """Total capture-backed money released to the business, in integer cents.

    Reads through :func:`escrow.money_cents` (cents column authoritative, dollar
    column only as a pre-migration fallback) and skips any row
    :func:`escrow.was_ever_captured` rejects. See the module docstring for why
    that filter is not optional.

    It is ``was_ever_captured`` and NOT ``is_capture_backed``: the latter asks
    whether money is in escrow *right now* and therefore answers False for
    every ``fully_released`` row — which is every row a business has actually
    earned. Using it here would compute a permanent balance of zero.
    """
    total = 0
    for row in payment_rows or []:
        if not escrow.was_ever_captured(row):
            continue
        total += escrow.money_cents(row, "released_to_business")
    return total


def paid_out_cents(payout_rows: Iterable[dict]) -> int:
    """Total already moved off the platform for this business, in integer cents.

    Counts a row if and only if its Stripe transfer succeeded. A row still
    ``pending`` with no transfer id has moved nothing and must not reduce the
    balance; a row that says ``failed`` but carries a transfer id HAS moved
    money and must.
    """
    total = 0
    for row in payout_rows or []:
        if not row.get("stripe_transfer_id"):
            continue
        total += int(row.get("amount_cents") or 0)
    return total


def available_cents(payment_rows: Iterable[dict], payout_rows: Iterable[dict]) -> int:
    """What this business can cash out right now, in integer cents.

    Floored at zero. A negative result would mean more has been paid out than
    was ever earned — a real reconciliation problem, but one a wallet screen
    must not express as a negative balance the owner cannot act on. It is logged
    at WARNING so it surfaces somewhere it can be investigated rather than being
    silently clamped.
    """
    earned = earned_cents(payment_rows)
    sent = paid_out_cents(payout_rows)
    net = earned - sent
    if net < 0:
        logger.warning(
            "payout balance is negative: earned=%d cents, paid_out=%d cents. "
            "More has left the platform than the ledger says was earned — "
            "reconcile payouts against payments.",
            earned,
            sent,
        )
        return 0
    return net


def summarize(payment_rows: Iterable[dict], payout_rows: Iterable[dict]) -> dict:
    """The full balance picture, as the wallet endpoint returns it.

    ``lifetime_earned_cents`` and ``paid_out_cents`` are included alongside
    ``available_cents`` because a bare "available" number is unauditable: a
    business that sees a figure it disagrees with has no way to find out which
    half is wrong.
    """
    payment_rows = list(payment_rows or [])
    payout_rows = list(payout_rows or [])
    earned = earned_cents(payment_rows)
    sent = paid_out_cents(payout_rows)
    return {
        "available_cents": max(earned - sent, 0),
        "lifetime_earned_cents": earned,
        "paid_out_cents": sent,
        "currency": "cad",
    }


def map_stripe_payout_status(stripe_status: str | None) -> str:
    """Normalise a Stripe payout status onto the values the DB CHECK allows.

    Stripe's vocabulary is already the one this table stores, so this is mostly
    an identity function — its job is to stop an unrecognised future value from
    violating the CHECK constraint and 500ing a wallet read. Unknown values
    degrade to ``pending`` (still moving, re-check next read) rather than to a
    terminal state, because wrongly calling money "paid" is the expensive
    mistake and wrongly calling it "in flight" is the cheap one.
    """
    value = (stripe_status or "").strip().lower()
    if value in PAYOUT_STATUSES:
        return value
    if value:
        logger.warning(
            "unrecognised Stripe payout status %r — treating as pending", value
        )
    return "pending"


def public_payout(row: dict[str, Any]) -> dict[str, Any]:
    """Shape a payouts row for the app.

    Deliberately drops ``stripe_transfer_id`` / ``stripe_account_id``: internal
    plumbing ids the owner cannot act on. ``stripe_payout_id`` is kept because
    it is the reference Stripe support asks for when a payout goes missing.
    """
    return {
        "id": row.get("id"),
        "amount_cents": int(row.get("amount_cents") or 0),
        "currency": row.get("currency") or "cad",
        "status": row.get("status"),
        # May be NULL on a row that failed before Stripe accepted it — the app
        # must not print a rail for a payout that never got one.
        "method": row.get("method"),
        "arrival_date": row.get("arrival_date"),
        "failure_reason": row.get("failure_reason"),
        "created_at": row.get("created_at"),
        "stripe_payout_id": row.get("stripe_payout_id"),
    }


__all__ = [
    "UNSETTLED_STATUSES",
    "PAYOUT_STATUSES",
    "earned_cents",
    "paid_out_cents",
    "available_cents",
    "summarize",
    "map_stripe_payout_status",
    "public_payout",
]
