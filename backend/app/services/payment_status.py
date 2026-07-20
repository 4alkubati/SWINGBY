"""
payment_status.py — the ONE payment status vocabulary (PAYMENT-MODEL.md §4).

`payments.status` and `bookings.payment_status` share this exact enum — do
not maintain a second vocabulary. Every literal written anywhere in
backend/app should come from here (imported, not re-typed), so that
`tests/test_payment_status_vocabulary.py` can verify no reader ever filters
on a value nothing writes.

Migration: backend/migrations/0001_payment_status_vocabulary.sql moves the DB
CHECK constraints to this enum and backfills existing rows:
    partial    -> partial_released
    paid_full  -> held
"""

from __future__ import annotations

# Booking proposed; charge not yet attempted or in flight.
PENDING_PAYMENT = "pending_payment"

# Charge attempted and declined. No booking exists.
FAILED = "failed"

# Charged. Full business_net in escrow, nothing released.
HELD = "held"

# First tranche released to business.
PARTIAL_RELEASED = "partial_released"

# All of business_net released.
FULLY_RELEASED = "fully_released"

# Settled via cancellation or dispute.
REFUNDED = "refunded"

# Cash job — platform never held the principal, only took its cut.
PAID_OFF_PLATFORM = "paid_off_platform"

ALL = frozenset(
    {
        PENDING_PAYMENT,
        FAILED,
        HELD,
        PARTIAL_RELEASED,
        FULLY_RELEASED,
        REFUNDED,
        PAID_OFF_PLATFORM,
    }
)

# Statuses that mean "money has actually moved / been secured" — used by
# guards that must not let a booking with real money behind it be diverted
# (e.g. re-marked as a cash job).
CARD_SECURED = frozenset({HELD, PARTIAL_RELEASED, FULLY_RELEASED})
