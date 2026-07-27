"""refunds.py — return money to the client, and record that it happened.

AMENDMENT 1 (agents/briefs/PAYMENT-MODEL.md, Kira 2026-07-26) introduced two
moments where money goes back:

    accepting a quote below budget  ->  refund (budget - accepted)
    a post expiring unquoted        ->  refund everything still held

Both funnel through here. `stripe_service.refund_payment_intent` already talks
to Stripe; this is the layer that decides HOW MUCH, does it exactly once, and
writes the ledger only after Stripe confirms.

THE ORDER IS THE WHOLE POINT
----------------------------
Stripe first, ledger second. Never the reverse.

A ledger marked refunded with no Stripe refund behind it is the FINDING C
failure repeated: 24 rows and $4,675.50 sat in production claiming money had
been released with no PaymentIntent to show for it, and every earnings screen
believed them. A client whose refund silently failed would see "refunded" and
still be out their money. If Stripe raises, this function raises, and the
ledger is untouched — the refund can then be retried, which is the correct
recoverable state.

The opposite failure (Stripe refunds, ledger write fails) is real but strictly
better: the money is genuinely back with the client, and the sweep will retry.
Retrying is safe because `stripe.Refund.create` is called with an idempotency
key derived from the row and the reason, so a second attempt for the same
reason returns the SAME refund rather than sending money twice.

NOTHING HERE DECIDES POLICY
---------------------------
How much to refund is `budget_settlement`'s job; whether the client is entitled
is the caller's. This module only moves the money and records it.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.services import escrow, stripe_service
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

# Why a refund happened. Part of the idempotency key, so "refund the unused
# budget" and "refund everything on expiry" can both fire against one row
# without the second being mistaken for a retry of the first.
REASON_UNDER_BUDGET = "under_budget"
REASON_EXPIRED = "post_expired"
REASON_CANCELLED = "post_cancelled"

VALID_REASONS = (REASON_UNDER_BUDGET, REASON_EXPIRED, REASON_CANCELLED)


class RefundNotPossible(RuntimeError):
    """Raised when there is nothing to refund, or nothing to refund it from."""


def refundable_cents(payment: dict) -> int:
    """How much of this row could still go back to the client.

    Money that has already been released to the business is NOT refundable
    here — clawing that back is the cancellation ladder's job (spec S7), which
    has its own penalty rules. This is only ever the part still held.
    """
    if not payment:
        return 0
    held_c = escrow.money_cents(payment, "escrow_held")
    return max(held_c, 0)


def refund_payment_row(
    payment: dict,
    *,
    amount_cents: int,
    reason: str,
    actor_id: Optional[str] = None,
) -> dict:
    """Refund `amount_cents` against one payments row. Stripe first, then ledger.

    Returns the updated payments row. Raises RefundNotPossible when the request
    is not sane, and lets HTTPException from Stripe propagate so the caller can
    decide whether a failure is fatal (accept: no, the booking stands) or
    retryable (expiry sweep: yes, try again next run).
    """
    if reason not in VALID_REASONS:
        raise RefundNotPossible(f"unknown refund reason {reason!r}")
    if amount_cents <= 0:
        raise RefundNotPossible("refund amount must be greater than zero")

    intent_id = (payment or {}).get("stripe_payment_intent_id")
    if not intent_id:
        # No capture ever happened, so there is nothing at Stripe to reverse.
        # This is NOT an error state for an unpaid row — it is the normal case
        # for a post that was never charged — but it must never be recorded as
        # a refund, or the ledger would claim money moved that never existed.
        raise RefundNotPossible(
            "no captured PaymentIntent on this payment row — nothing to refund"
        )

    available_c = refundable_cents(payment)
    if amount_cents > available_c:
        raise RefundNotPossible(
            f"asked to refund {amount_cents}c but only {available_c}c is still held"
        )

    already_refunded_c = escrow.money_cents(payment, "refunded")

    # Stripe FIRST. If this raises, we have written nothing.
    #
    # The idempotency key is what makes the retry story true rather than
    # aspirational: the expiry sweep leaves a failed post open and tries again
    # next run, and without this a second attempt sends the money twice. Keyed
    # on (row, reason) so an under-budget refund and a later expiry refund on
    # the same row are distinct operations, not mistaken retries of each other.
    refund = stripe_service.refund_payment_intent(
        payment_intent_id=intent_id,
        amount_cad=round(amount_cents / 100, 2),
        idempotency_key=f"refund:{payment['id']}:{reason}",
    )

    new_refunded_c = already_refunded_c + amount_cents
    new_escrow_c = available_c - amount_cents

    update = escrow.ledger_write(
        escrow_held=new_escrow_c,
        refunded=new_refunded_c,
    )
    update["stripe_refund_id"] = refund.get("id")
    update["refunded_at"] = "now()"

    # A row whose entire charge has gone back is settled, whatever it was
    # before. A partial refund leaves the status alone: the job is still live.
    total_c = escrow.money_cents(payment, "total_charged")
    if new_refunded_c >= total_c > 0:
        update["status"] = "refunded"

    res = supabase.table("payments").update(update).eq("id", payment["id"]).execute()
    row = (res.data or [None])[0]

    logger.info(
        "refund %s: %dc against payment %s (reason=%s, stripe_refund=%s)",
        "settled" if new_refunded_c >= total_c else "partial",
        amount_cents,
        payment.get("id"),
        reason,
        refund.get("id"),
    )
    return row or {**payment, **update}


def load_post_payment(post_id: str) -> Optional[dict]:
    """The payments row created when this post's budget was charged, if any.

    Flow B posts have no such row — nothing is charged until a quote is
    accepted there — so a missing row is a normal answer, not a failure.
    """
    if not post_id:
        return None
    try:
        res = (
            supabase.table("payments")
            .select("*")
            .eq("post_id", post_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("could not load payment row for post %s", post_id)
        return None
    return (res.data or [None])[0]
