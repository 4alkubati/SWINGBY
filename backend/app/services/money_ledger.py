"""
money_ledger.py — CARD-21. Internal reconciliation layer for the Uber-style
money model (full capture at confirmation, held on the platform balance,
business share transferred only at completion).

Every booking that goes through Stripe Checkout gets one `payment_ledger`
row tracking EXPECTED amounts (computed from `bookings.total_amount` /
`commission_rate` the moment the booking is created) side by side with the
ACTUAL Stripe objects (checkout session, payment intent, refund) as they
happen. A mismatch between expected and actual is flagged, never silently
reconciled — see `flag_if_mismatch`.

Schema: `docs/payment_ledger_table.sql` (FILED, NOT applied to live Supabase
per CARD-21 instructions — a migration is database-agent's call). All writes
here are best-effort: a ledger failure must never break the booking/payment
flow it's observing, so every public function swallows and logs its own
exceptions.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.supabase_client import supabase

logger = logging.getLogger(__name__)

_CENTS_TOLERANCE = 0.01  # one cent — anything beyond this is a real mismatch


def compute_expected(total_amount: float, commission_rate: float = 0.10) -> dict[str, float]:
    """Pure function — the expected split for a booking. No I/O, fully unit-testable."""
    total_amount = round(float(total_amount), 2)
    platform_cut = round(total_amount * commission_rate, 2)
    business_share = round(total_amount - platform_cut, 2)
    return {
        "expected_total": total_amount,
        "expected_platform_cut": platform_cut,
        "expected_business_share": business_share,
    }


def create_ledger_row(
    *, booking_id: str, payment_id: Optional[str], total_amount: float, commission_rate: float = 0.10
) -> Optional[dict[str, Any]]:
    """Called at accept-interest time. No money has moved yet — status='pending'."""
    expected = compute_expected(total_amount, commission_rate)
    try:
        res = (
            supabase.table("payment_ledger")
            .insert(
                {
                    "booking_id": booking_id,
                    "payment_id": payment_id,
                    **expected,
                    "status": "pending",
                }
            )
            .execute()
        )
        return (res.data or [None])[0]
    except Exception:
        logger.warning("Could not create ledger row for booking %s", booking_id, exc_info=True)
        return None


def record_capture(
    *,
    booking_id: str,
    stripe_checkout_session_id: Optional[str],
    stripe_payment_intent_id: Optional[str],
    actual_captured_amount: Optional[float] = None,
) -> Optional[dict[str, Any]]:
    """
    Called from the Stripe webhook on checkout.session.completed. Full amount
    is now captured and held on the platform balance — released_to_business
    must remain 0 (asserted by the caller / covered by tests).
    """
    update: dict[str, Any] = {
        "status": "captured",
        "stripe_checkout_session_id": stripe_checkout_session_id,
        "stripe_payment_intent_id": stripe_payment_intent_id,
    }
    if actual_captured_amount is not None:
        update["actual_captured_amount"] = round(actual_captured_amount, 2)
    try:
        row = _get_row(booking_id)
        if row and actual_captured_amount is not None:
            mismatch, note = _mismatch(row["expected_total"], actual_captured_amount)
            update["mismatch"] = mismatch
            if mismatch:
                update["mismatch_notes"] = note
        res = (
            supabase.table("payment_ledger").update(update).eq("booking_id", booking_id).execute()
        )
        return (res.data or [None])[0]
    except Exception:
        logger.warning("Could not record capture for booking %s", booking_id, exc_info=True)
        return None


def record_release(
    *, booking_id: str, actual_business_share_released: float
) -> Optional[dict[str, Any]]:
    """Called at booking completion — the only point the business gets paid."""
    update: dict[str, Any] = {
        "status": "completed_released",
        "actual_business_share_released": round(actual_business_share_released, 2),
    }
    try:
        row = _get_row(booking_id)
        if row:
            mismatch, note = _mismatch(
                row["expected_business_share"], actual_business_share_released
            )
            if mismatch:
                update["mismatch"] = True
                update["mismatch_notes"] = (row.get("mismatch_notes") or "") + " | " + note
        res = (
            supabase.table("payment_ledger").update(update).eq("booking_id", booking_id).execute()
        )
        return (res.data or [None])[0]
    except Exception:
        logger.warning("Could not record release for booking %s", booking_id, exc_info=True)
        return None


def record_refund(
    *,
    booking_id: str,
    stripe_refund_id: Optional[str],
    actual_refund_amount: float,
    expected_penalty: Optional[float] = None,
) -> Optional[dict[str, Any]]:
    """Called on cancel — refund comes out of the platform balance."""
    update: dict[str, Any] = {
        "status": "refunded",
        "stripe_refund_id": stripe_refund_id,
        "actual_refund_amount": round(actual_refund_amount, 2),
    }
    if expected_penalty is not None:
        update["expected_penalty"] = round(expected_penalty, 2)
    try:
        res = (
            supabase.table("payment_ledger").update(update).eq("booking_id", booking_id).execute()
        )
        return (res.data or [None])[0]
    except Exception:
        logger.warning("Could not record refund for booking %s", booking_id, exc_info=True)
        return None


def get_ledger_row(booking_id: str) -> Optional[dict[str, Any]]:
    """Public accessor — callers (e.g. the refund path in bookings.py) that
    need the stored Stripe object ids to act on them should use this rather
    than reaching into the module's own internals."""
    return _get_row(booking_id)


def _get_row(booking_id: str) -> Optional[dict[str, Any]]:
    try:
        res = (
            supabase.table("payment_ledger")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        return res.data
    except Exception:
        return None


def _mismatch(expected: float, actual: float) -> tuple[bool, str]:
    diff = round(abs(float(expected) - float(actual)), 2)
    if diff > _CENTS_TOLERANCE:
        return True, f"expected {expected:.2f}, actual {actual:.2f} (diff {diff:.2f})"
    return False, ""
