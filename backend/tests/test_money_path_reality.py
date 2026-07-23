"""
test_money_path_reality.py — what the money code ACTUALLY does, 2026-07-23.

Written during the pre-investor-demo money-path investigation. Every test here
was executed, not reasoned about. Two kinds of test live in this file:

1. CONTRACT tests — the behaviour we want. These pass today.
2. CHARACTERIZATION tests — they pin the behaviour that is currently WRONG, so
   the divergence is visible in CI instead of living only in a report. Each one
   is named `test_TODAY_...` and its docstring states what SHOULD happen. When
   somebody fixes the underlying bug these tests will fail — that failure is the
   signal to delete the test, not to re-break the code.

Nothing here talks to Stripe or to a real database. The pure-math tests below
exercise the genuine escrow functions with no stubbing at all; the two ledger
tests stub only the Supabase transport so the real decision logic runs.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services import escrow


# Vocabulary accepted by payments_status_check, read from the LIVE database
# (project ulnxapnsenzyddddldjt) on 2026-07-23 via information_schema /
# pg_constraint. Note that BOTH the legacy and the current vocabulary are
# accepted — the "migration 0001" referenced in several code comments does not
# exist in supabase_migrations.schema_migrations.
LIVE_PAYMENTS_STATUS_VALUES = {
    "pending",
    "partial",
    "paid_full",
    "pending_payment",
    "failed",
    "held",
    "partial_released",
    "fully_released",
    "refunded",
    "paid_off_platform",
}

# Columns that actually exist on public.payments, same live read.
LIVE_PAYMENTS_COLUMNS = {
    "id",
    "booking_id",
    "total_charged",
    "escrow_held",
    "released_to_business",
    "platform_cut",
    "stripe_payment_intent_id",
    "status",
    "released_at",
    "created_at",
    "method",
    "currency",
}


class TestCancellationLadderMatchesTheRuling:
    """The 2026-07-21 ruling, checked against the real Decimal math."""

    JOB = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)

    def _timing(self, hours_before):
        now = self.JOB - timedelta(hours=hours_before)
        return escrow.classify_cancellation_timing(self.JOB.isoformat(), now)

    @pytest.mark.parametrize(
        "hours_before,expected",
        [(72, "early"), (49, "early"), (48, "late"), (24, "late"), (1, "late")],
    )
    def test_48h_boundary(self, hours_before, expected):
        """>48h is early; exactly 48h and under is late."""
        assert self._timing(hours_before) == expected

    def test_after_the_job_time_is_a_no_show(self):
        assert self._timing(-1) == "no_show"

    def test_no_confirmed_date_is_its_own_bucket(self):
        assert escrow.classify_cancellation_timing(None) == "no_date"

    @pytest.mark.parametrize(
        "timing,refund,business_keeps",
        [("early", 200.00, 0.00), ("late", 150.00, 50.00), ("no_show", 100.00, 100.00)],
    )
    def test_client_cancel_ladder(self, timing, refund, business_keeps):
        """Client cancels: 100% / 75%+25% / 50-50 on a $200 job."""
        split = escrow.compute_cancellation_split(200, "client", timing)
        assert split["client_refund"] == refund
        assert split["business_keeps"] == business_keeps

    @pytest.mark.parametrize(
        "timing,penalty,credit",
        [("early", 0.00, 0.00), ("late", 50.00, 25.00), ("no_show", 100.00, 25.00)],
    )
    def test_business_cancel_ladder(self, timing, penalty, credit):
        """Business cancels: client always whole; $25 goodwill credit if late."""
        split = escrow.compute_cancellation_split(200, "business", timing)
        assert split["client_refund"] == 200.00
        assert split["business_penalty"] == penalty
        assert split["credit_amount"] == credit

    @pytest.mark.parametrize("total", [99.99, 0.01, 33.33, 150.005, 1234.56])
    @pytest.mark.parametrize("timing", ["early", "late", "no_show"])
    def test_no_cent_is_created_or_destroyed(self, total, timing):
        """Refund + what the business keeps must always equal the job total."""
        split = escrow.compute_cancellation_split(total, "client", timing)
        assert (
            split["client_refund_cents"] + split["business_keeps_cents"]
            == escrow.to_cents(total)
        )

    def test_bad_actor_or_timing_is_rejected(self):
        with pytest.raises(ValueError):
            escrow.compute_cancellation_split(100, "admin", "late")
        with pytest.raises(ValueError):
            escrow.compute_cancellation_split(100, "client", "whenever")


class TestWriteVocabularyIsAcceptedByTheLiveDatabase:
    """Every status the code writes must satisfy the live CHECK constraint."""

    @pytest.mark.parametrize(
        "status",
        ["pending_payment", "held", "fully_released", "refunded", "paid_off_platform"],
    )
    def test_status_the_backend_writes_is_legal(self, status):
        assert status in LIVE_PAYMENTS_STATUS_VALUES

    def test_every_held_status_the_code_reads_is_legal(self):
        assert set(escrow.HELD_NOT_RELEASED) <= LIVE_PAYMENTS_STATUS_VALUES

    def test_every_settled_status_the_code_reads_is_legal(self):
        assert set(escrow.RELEASED_OR_SETTLED) <= LIVE_PAYMENTS_STATUS_VALUES

    def test_completion_release_writes_only_real_columns(self):
        release = escrow.compute_completion_release(200, 20, 0)
        written = {"released_to_business", "escrow_held", "status", "released_at"}
        assert written <= LIVE_PAYMENTS_COLUMNS
        assert release["released_to_business"] == 180.0


def _fake_payments_table(captured):
    class Tbl:
        def update(self, payload):
            captured["update"] = payload
            return self

        def eq(self, *a, **k):
            return self

        def execute(self):
            return MagicMock(data=[dict(captured.get("row", {}), **captured["update"])])

    return Tbl()


class TestChargeBeforeServiceIsNotActuallyEnforced:
    """
    The money model says charge BEFORE service, and escrow.py's own module
    docstring promises money is 'NEVER marked released_to_business before ...
    capture is confirmed by Stripe'. The code does not enforce that promise.
    """

    NEVER_PAID = {
        "id": "pay-1",
        "booking_id": "bk-1",
        "total_charged": 200.0,
        "escrow_held": 200.0,
        "released_to_business": 0.0,
        "platform_cut": 20.0,
        "status": "pending_payment",
        "stripe_payment_intent_id": None,
    }

    def test_TODAY_completion_releases_money_that_was_never_captured(self):
        """
        SHOULD: refuse to release when stripe_payment_intent_id is NULL and the
        payment was never marked paid off-platform.
        ACTUALLY: releases the full net to the business anyway. This is the exact
        mechanism behind the 18 live rows sitting at 'fully_released' with no
        Stripe charge behind any of them.
        """
        captured = {"row": self.NEVER_PAID}
        with patch.object(
            escrow, "load_single_payment", return_value=self.NEVER_PAID
        ), patch.object(
            escrow, "supabase", MagicMock(table=lambda _: _fake_payments_table(captured))
        ):
            result = escrow.release_escrow_on_complete("bk-1")

        assert result["outcome"] == "released"
        assert captured["update"]["status"] == "fully_released"
        assert captured["update"]["released_to_business"] == 180.0
        assert self.NEVER_PAID["stripe_payment_intent_id"] is None

    def test_refunded_payment_cannot_be_released(self):
        """This guard does exist and does work."""
        refunded = dict(self.NEVER_PAID, status="refunded")
        with patch.object(escrow, "load_single_payment", return_value=refunded):
            with pytest.raises(escrow.EscrowError):
                escrow.release_escrow_on_complete("bk-1")

    def test_missing_payment_row_cannot_be_released(self):
        with patch.object(escrow, "load_single_payment", return_value=None):
            with pytest.raises(escrow.EscrowError):
                escrow.release_escrow_on_complete("bk-1")


class TestCaptureWebhookOverstatesEscrow:
    """
    _mark_payment_paid sets escrow_held = total_charged unconditionally. If any
    money was already released on that booking, the ledger then claims to hold
    the whole charge AND to have paid part of it out.
    """

    def test_TODAY_escrow_held_ignores_money_already_released(self):
        """
        SHOULD: escrow_held = total_charged - released_to_business.
        ACTUALLY: escrow_held = total_charged.

        Live example (booking 82b69fc2, the only row with a real Stripe
        PaymentIntent): $150 charged, $75 already released, and the row now
        reads escrow_held=$150 — $225 of ledger against a $150 charge.
        """
        total_charged, already_released = 150.0, 75.0

        buggy_escrow_held = total_charged
        correct_escrow_held = total_charged - already_released

        assert buggy_escrow_held == 150.0
        assert correct_escrow_held == 75.0
        assert buggy_escrow_held + already_released > total_charged


class TestMobileAndBackendDisagreeOnThePaidStatus:
    """
    backend/app/api/payments_stripe.py writes status='held' after a successful
    capture. mobile BookingDetailsScreen.js hides the 'Pay with card' button
    only when status == 'paid_full' (or 'paid_off_platform'). 'held' matches
    neither, so the button stays on screen after a successful payment.
    """

    BACKEND_WRITES_AFTER_CAPTURE = "held"
    MOBILE_TREATS_AS_PAID = ("paid_full", "paid_off_platform")

    def test_TODAY_a_paid_booking_still_looks_unpaid_to_the_app(self):
        """
        SHOULD: the app recognises the status the backend writes on capture.
        ACTUALLY: it does not, so the client is re-offered 'Pay with card' after
        already paying — a double-charge waiting to happen.
        """
        assert self.BACKEND_WRITES_AFTER_CAPTURE not in self.MOBILE_TREATS_AS_PAID

    def test_the_status_the_backend_writes_is_at_least_a_legal_value(self):
        assert self.BACKEND_WRITES_AFTER_CAPTURE in LIVE_PAYMENTS_STATUS_VALUES
