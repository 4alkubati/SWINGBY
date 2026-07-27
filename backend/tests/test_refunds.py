"""Refunds: Stripe first, ledger second, and never twice.

AMENDMENT 1 gives money back in two places — accepting below budget, and a post
expiring unquoted. Both go through app/services/refunds.py.

The ordering assertions here are the important ones. A ledger row marked
refunded with no Stripe refund behind it is FINDING C repeated: 24 rows and
$4,675.50 sat in production claiming money had moved with no PaymentIntent, and
every earnings screen believed them. A client whose refund silently failed would
read "refunded" and still be out their money.
"""

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.services import refunds


def _payment(**over):
    row = {
        "id": "pay_1",
        "post_id": "post_1",
        "booking_id": None,
        "stripe_payment_intent_id": "pi_live_1",
        "total_charged_cents": 15000,
        "escrow_held_cents": 15000,
        "released_to_business_cents": 0,
        "platform_cut_cents": 0,
        "refunded_cents": 0,
        "status": "held",
    }
    row.update(over)
    return row


class TestHowMuchCanGoBack:
    def test_only_what_is_still_held(self):
        assert refunds.refundable_cents(_payment()) == 15000

    def test_money_already_paid_out_is_not_refundable_here(self):
        # Clawing back a released tranche is the cancellation ladder's job
        # (spec S7), which has penalty rules this module must not bypass.
        p = _payment(escrow_held_cents=5000, released_to_business_cents=10000)
        assert refunds.refundable_cents(p) == 5000

    def test_a_missing_row_refunds_nothing(self):
        assert refunds.refundable_cents(None) == 0
        assert refunds.refundable_cents({}) == 0


class TestStripeComesFirst:
    def test_a_stripe_failure_writes_NOTHING_to_the_ledger(self):
        # The whole reason for the ordering. If Stripe raises, the row must be
        # untouched so the refund can be retried — not marked done.
        with patch.object(
            refunds.stripe_service,
            "refund_payment_intent",
            side_effect=HTTPException(status_code=502, detail="stripe down"),
        ), patch.object(refunds, "supabase") as db:
            with pytest.raises(HTTPException):
                refunds.refund_payment_row(
                    _payment(), amount_cents=5000, reason=refunds.REASON_UNDER_BUDGET
                )
            db.table.assert_not_called()

    def test_the_ledger_is_written_only_after_stripe_confirms(self):
        with patch.object(
            refunds.stripe_service,
            "refund_payment_intent",
            return_value={"id": "re_1", "status": "succeeded", "amount": 5000},
        ), patch.object(refunds, "supabase") as db:
            db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
                {"id": "pay_1"}
            ]
            refunds.refund_payment_row(
                _payment(), amount_cents=5000, reason=refunds.REASON_UNDER_BUDGET
            )
            update = db.table.return_value.update.call_args[0][0]
            assert update["refunded_cents"] == 5000
            assert update["escrow_held_cents"] == 10000  # 150 - 50
            assert update["stripe_refund_id"] == "re_1"


class TestKirasNumbers:
    def test_accepting_100_of_a_150_budget_returns_50_and_leaves_100_held(self):
        with patch.object(
            refunds.stripe_service,
            "refund_payment_intent",
            return_value={"id": "re_1", "status": "succeeded", "amount": 5000},
        ), patch.object(refunds, "supabase") as db:
            db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
                {}
            ]
            refunds.refund_payment_row(
                _payment(), amount_cents=5000, reason=refunds.REASON_UNDER_BUDGET
            )
            u = db.table.return_value.update.call_args[0][0]
            # escrow 100 + refunded 50 == the 150 that was charged.
            assert u["escrow_held_cents"] + u["refunded_cents"] == 15000

    def test_a_partial_refund_does_not_settle_the_row(self):
        # The job is still live; only the unused budget went back.
        with patch.object(
            refunds.stripe_service,
            "refund_payment_intent",
            return_value={"id": "re_1", "status": "succeeded", "amount": 5000},
        ), patch.object(refunds, "supabase") as db:
            db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
                {}
            ]
            refunds.refund_payment_row(
                _payment(), amount_cents=5000, reason=refunds.REASON_UNDER_BUDGET
            )
            assert "status" not in db.table.return_value.update.call_args[0][0]

    def test_refunding_the_whole_charge_settles_it(self):
        # The expiry case: nobody quoted, everything goes back.
        with patch.object(
            refunds.stripe_service,
            "refund_payment_intent",
            return_value={"id": "re_2", "status": "succeeded", "amount": 15000},
        ), patch.object(refunds, "supabase") as db:
            db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
                {}
            ]
            refunds.refund_payment_row(
                _payment(), amount_cents=15000, reason=refunds.REASON_EXPIRED
            )
            u = db.table.return_value.update.call_args[0][0]
            assert u["status"] == "refunded"
            assert u["escrow_held_cents"] == 0


class TestRefusals:
    def test_no_captured_intent_means_no_refund_is_ever_recorded(self):
        # An unpaid post is the NORMAL case for Flow B. It must never be
        # recorded as refunded, or the ledger claims money that never existed.
        with pytest.raises(refunds.RefundNotPossible, match="nothing to refund"):
            refunds.refund_payment_row(
                _payment(stripe_payment_intent_id=None),
                amount_cents=5000,
                reason=refunds.REASON_EXPIRED,
            )

    def test_cannot_refund_more_than_is_held(self):
        with pytest.raises(refunds.RefundNotPossible, match="only"):
            refunds.refund_payment_row(
                _payment(escrow_held_cents=1000),
                amount_cents=5000,
                reason=refunds.REASON_EXPIRED,
            )

    def test_zero_and_negative_are_refused(self):
        for bad in (0, -1):
            with pytest.raises(refunds.RefundNotPossible):
                refunds.refund_payment_row(
                    _payment(), amount_cents=bad, reason=refunds.REASON_EXPIRED
                )

    def test_an_unknown_reason_is_refused(self):
        # The reason is part of the idempotency story, so a typo must not
        # silently become a new refund.
        with pytest.raises(refunds.RefundNotPossible, match="unknown refund reason"):
            refunds.refund_payment_row(_payment(), amount_cents=100, reason="because")


class TestLoadingAPostsPayment:
    def test_a_flow_b_post_with_no_charge_returns_none_not_an_error(self):
        with patch.object(refunds, "supabase") as db:
            db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = (
                []
            )
            assert refunds.load_post_payment("post_x") is None

    def test_a_db_failure_is_survivable(self):
        with patch.object(refunds, "supabase") as db:
            db.table.side_effect = Exception("boom")
            assert refunds.load_post_payment("post_x") is None


class TestRetriesCannotDoublePay:
    def test_the_stripe_call_carries_an_idempotency_key(self):
        # The expiry sweep leaves a failed post OPEN and retries next run. That
        # is only safe if Stripe deduplicates the second attempt. Without this
        # key the retry sends the client's money a second time.
        with patch.object(
            refunds.stripe_service,
            "refund_payment_intent",
            return_value={"id": "re_1", "status": "succeeded", "amount": 5000},
        ) as stripe_call, patch.object(refunds, "supabase") as db:
            db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
                {}
            ]
            refunds.refund_payment_row(
                _payment(), amount_cents=5000, reason=refunds.REASON_UNDER_BUDGET
            )
            key = stripe_call.call_args.kwargs["idempotency_key"]
            assert "pay_1" in key and refunds.REASON_UNDER_BUDGET in key

    def test_different_reasons_get_different_keys(self):
        # An under-budget refund and a later expiry refund on the SAME row are
        # separate operations; sharing a key would make the second a silent no-op.
        keys = []
        for reason in (refunds.REASON_UNDER_BUDGET, refunds.REASON_EXPIRED):
            with patch.object(
                refunds.stripe_service,
                "refund_payment_intent",
                return_value={"id": "re", "status": "succeeded", "amount": 100},
            ) as call, patch.object(refunds, "supabase") as db:
                db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
                    {}
                ]
                refunds.refund_payment_row(_payment(), amount_cents=100, reason=reason)
                keys.append(call.call_args.kwargs["idempotency_key"])
        assert keys[0] != keys[1]
