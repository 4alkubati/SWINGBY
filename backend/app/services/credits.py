"""
credits.py — Customer credit ledger (integer cents).

A credit is money SwingBy owes a client as goodwill — today it is accrued only
when a business cancels late or no-shows (see the cancellation ladder in
app.services.escrow.compute_cancellation_split), and it is intended to be
redeemed against a future booking's charge.

Design (see docs/user_credits_table.sql):
  * ``user_credits`` is an append-only ledger. Each row is a signed cents delta:
      + amount_cents  → a GRANT (credit accrued to the user)
      - amount_cents  → a REDEMPTION (credit spent against a booking charge)
    The balance is SUM(amount_cents) — auditable, never a mutable wallet column.
  * A partial UNIQUE index on (booking_id) WHERE amount_cents < 0 guarantees at
    most ONE redemption debit per booking. That DB constraint — not application
    locking — is the anti-double-spend guard: two concurrent checkout calls for
    the same booking cannot both debit; the second insert fails and we treat it
    idempotently.

All money math is integer cents; helpers return cents so callers stay exact.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.supabase_client import supabase

logger = logging.getLogger(__name__)

# Goodwill credit granted to a client when the BUSINESS cancels late (<=48h) or
# no-shows. Flat, not a percentage: a flat gesture keeps the platform's credit
# liability predictable and decoupled from booking size (a business bailing on a
# $40 job and a $400 job cause similar inconvenience), and it is easy to fund —
# the business already eats a 25%/50% penalty on those paths. $25 CAD.
GOODWILL_CREDIT_CENTS = 2500

# Redemption of credit at checkout reduces what the client pays. It rides the
# SAME not-yet-live-Stripe-verified "charge-before-service" capture path as the
# rest of PR #30, so it stays OFF until that path is verified in Stripe test
# mode end-to-end. The redemption FUNCTION is fully built and unit-tested; only
# the auto-apply-at-checkout wiring is gated behind this flag.
CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED = False


class CreditError(RuntimeError):
    """Raised when a credit ledger write cannot be completed safely."""


def get_balance_cents(user_id: str) -> int:
    """Current credit balance for a user, in integer cents (SUM of the ledger)."""
    try:
        res = (
            supabase.table("user_credits")
            .select("amount_cents")
            .eq("user_id", user_id)
            .execute()
        )
    except Exception:
        logger.exception("credits.get_balance_cents failed for user %s", user_id)
        return 0
    return sum(int(r.get("amount_cents") or 0) for r in (res.data or []))


def get_history(user_id: str) -> list[dict]:
    """Full credit ledger for a user, newest first."""
    try:
        res = (
            supabase.table("user_credits")
            .select("id, amount_cents, reason, booking_id, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        logger.exception("credits.get_history failed for user %s", user_id)
        return []


def grant_credit(
    user_id: str,
    amount_cents: int,
    reason: str,
    booking_id: Optional[str] = None,
) -> Optional[dict]:
    """Accrue a positive credit for a user (append a +amount_cents ledger row).

    Returns the inserted row, or None if nothing was written (non-positive
    amount, or the insert failed — logged, never raised, so a goodwill grant
    can never break the money path that triggers it).
    """
    if amount_cents <= 0:
        return None
    try:
        res = (
            supabase.table("user_credits")
            .insert(
                {
                    "user_id": user_id,
                    "amount_cents": int(amount_cents),
                    "reason": reason,
                    "booking_id": booking_id,
                }
            )
            .execute()
        )
        row = (res.data or [None])[0]
        logger.info(
            "credits.grant %d cents to user %s (reason=%s booking=%s)",
            amount_cents,
            user_id,
            reason,
            booking_id,
        )
        return row
    except Exception:
        logger.exception(
            "credits.grant_credit FAILED — user %s did NOT receive %d cents "
            "(reason=%s booking=%s). Needs manual grant.",
            user_id,
            amount_cents,
            reason,
            booking_id,
        )
        return None


def redeemable_cents(user_id: str, gross_amount_cents: int) -> int:
    """How much credit can be applied to a ``gross_amount_cents`` charge.

    = min(available balance, gross). Never negative, never more than the charge
    (a redemption can zero a charge but not overshoot into a negative charge).
    """
    if gross_amount_cents <= 0:
        return 0
    balance = get_balance_cents(user_id)
    if balance <= 0:
        return 0
    return min(balance, gross_amount_cents)


def redeem_credit_for_booking(
    user_id: str, booking_id: str, gross_amount_cents: int
) -> dict:
    """Apply available credit to reduce a booking's charge.

    Inserts a single negative ledger row (the redemption debit) and returns::

        {"applied_cents": int, "net_amount_cents": int, "redeemed": bool}

    Anti-double-spend: exactly one redemption debit may exist per booking,
    enforced by a partial UNIQUE index in the DB (not app-level locking). If a
    debit already exists for this booking (e.g. a retried/concurrent checkout),
    the insert raises a unique violation; we catch it, re-read the existing
    debit, and return a consistent result instead of debiting twice.

    NOTE: this records the redemption at the moment it is applied to the charge.
    If a checkout session is created but abandoned, the credit stays spent until
    a follow-up "release unused reservation" pass exists — tracked as a known
    limitation while redemption-at-checkout is gated OFF
    (CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED). See the PR notes.
    """
    applied = redeemable_cents(user_id, gross_amount_cents)
    if applied <= 0:
        return {
            "applied_cents": 0,
            "net_amount_cents": max(gross_amount_cents, 0),
            "redeemed": False,
        }

    try:
        supabase.table("user_credits").insert(
            {
                "user_id": user_id,
                "amount_cents": -int(applied),
                "reason": "redemption_at_checkout",
                "booking_id": booking_id,
            }
        ).execute()
    except Exception as exc:
        # Most likely the partial-unique-index violation: this booking already
        # has a redemption debit. Re-read it so the caller charges consistently
        # rather than debiting a second time.
        existing = _existing_redemption_cents(booking_id)
        if existing > 0:
            logger.info(
                "credits.redeem idempotent — booking %s already redeemed %d cents",
                booking_id,
                existing,
            )
            return {
                "applied_cents": existing,
                "net_amount_cents": max(gross_amount_cents - existing, 0),
                "redeemed": True,
            }
        logger.exception(
            "credits.redeem_credit_for_booking failed for booking %s: %s",
            booking_id,
            exc,
        )
        raise CreditError("Could not record credit redemption") from exc

    logger.info(
        "credits.redeem %d cents against booking %s for user %s",
        applied,
        booking_id,
        user_id,
    )
    return {
        "applied_cents": applied,
        "net_amount_cents": max(gross_amount_cents - applied, 0),
        "redeemed": True,
    }


def _existing_redemption_cents(booking_id: str) -> int:
    """Absolute cents already redeemed against a booking (0 if none)."""
    try:
        res = (
            supabase.table("user_credits")
            .select("amount_cents")
            .eq("booking_id", booking_id)
            .lt("amount_cents", 0)
            .execute()
        )
        return sum(abs(int(r.get("amount_cents") or 0)) for r in (res.data or []))
    except Exception:
        logger.exception(
            "credits._existing_redemption_cents lookup failed for booking %s",
            booking_id,
        )
        return 0
