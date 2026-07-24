"""
test_money_guards.py — Money-lane fixes for the 2026-07-25 investor demo.

Covers the four things the 2026-07-23 money-path investigation found:

  FINDING C — completing a job released money with no proof a charge happened.
              escrow.assert_capture_backed() / is_capture_backed() now gate it.
  FINDING D — the Stripe capture path overwrote escrow_held, double-counting a
              partially-released booking. escrow.compute_capture_hold() holds
              only the remainder.
  Item 11   — money is integer cents; escrow.ledger_write / money_cents keep the
              cents column authoritative and the dollar mirror in lockstep.
  Item 12   — charge-before-service triggers (payment_triggers) at POST + ACCEPT.

Nothing here talks to Stripe or a real database.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.services import escrow, payment_triggers

# ── Item 11: cents representation ────────────────────────────────────────────


class TestLedgerWriteAndMoneyCents:
    def test_ledger_write_emits_both_representations(self):
        out = escrow.ledger_write(escrow_held=15000, released_to_business=0)
        assert out["escrow_held_cents"] == 15000
        assert out["escrow_held"] == 150.0
        assert out["released_to_business_cents"] == 0
        assert out["released_to_business"] == 0.0

    def test_ledger_write_rejects_unknown_column(self):
        with pytest.raises(ValueError):
            escrow.ledger_write(not_a_money_column=1)

    def test_money_cents_prefers_the_cents_column(self):
        row = {"total_charged": 999.99, "total_charged_cents": 15000}
        # cents column wins even when the dollar mirror disagrees
        assert escrow.money_cents(row, "total_charged") == 15000

    def test_money_cents_falls_back_to_dollars_for_legacy_rows(self):
        row = {"total_charged": 150.0}  # pre-migration row, no cents column
        assert escrow.money_cents(row, "total_charged") == 15000

    def test_money_cents_of_missing_is_zero(self):
        assert escrow.money_cents({}, "total_charged") == 0
        assert escrow.money_cents(None, "escrow_held") == 0


# ── FINDING D: capture hold is the remainder ─────────────────────────────────


class TestCaptureHold:
    def test_remainder_after_prior_release(self):
        # booking 82b69fc2: $150 charged, $75 already released → hold $75, not $150
        hold = escrow.compute_capture_hold(15000, 7500)
        assert hold["escrow_held_cents"] == 7500
        assert hold["escrow_held_cents"] + 7500 <= 15000

    def test_full_hold_when_nothing_released(self):
        assert escrow.compute_capture_hold(15000, 0)["escrow_held_cents"] == 15000

    def test_never_negative(self):
        assert escrow.compute_capture_hold(15000, 20000)["escrow_held_cents"] == 0


# ── FINDING C: capture-backed check ──────────────────────────────────────────


class TestIsCaptureBacked:
    def test_on_platform_held_with_intent_is_backed(self):
        assert escrow.is_capture_backed(
            {"status": "held", "stripe_payment_intent_id": "pi_1"}
        )

    def test_held_without_intent_is_not_backed(self):
        assert not escrow.is_capture_backed(
            {"status": "held", "stripe_payment_intent_id": None}
        )

    def test_pending_payment_is_not_backed(self):
        assert not escrow.is_capture_backed(
            {"status": "pending_payment", "stripe_payment_intent_id": None}
        )

    def test_off_platform_status_is_backed(self):
        assert escrow.is_capture_backed({"status": "paid_off_platform"})

    def test_off_platform_method_is_backed(self):
        assert escrow.is_capture_backed({"status": "held", "method": "cash"})
        assert escrow.is_capture_backed({"status": "held", "method": "e_transfer"})

    def test_legacy_paid_full_with_intent_is_backed(self):
        assert escrow.is_capture_backed(
            {"status": "paid_full", "stripe_payment_intent_id": "pi_1"}
        )

    def test_none_is_not_backed(self):
        assert not escrow.is_capture_backed(None)


class TestAssertCaptureBacked:
    def test_raises_for_uncaptured(self):
        with pytest.raises(escrow.CaptureRequiredError):
            escrow.assert_capture_backed(
                {"booking_id": "b1", "status": "pending_payment"}
            )

    def test_passes_for_captured(self):
        # Should not raise.
        escrow.assert_capture_backed(
            {"status": "held", "stripe_payment_intent_id": "pi_1"}
        )

    def test_bypass_env_downgrades_to_warning(self, monkeypatch):
        monkeypatch.setenv("PAYMENT_REQUIRE_CAPTURE", "0")
        # No raise even though the payment is not capture-backed.
        escrow.assert_capture_backed(
            {"booking_id": "b1", "status": "pending_payment", "total_charged": 100.0}
        )

    def test_require_capture_default_is_on(self, monkeypatch):
        monkeypatch.delenv("PAYMENT_REQUIRE_CAPTURE", raising=False)
        assert escrow.require_capture_enabled() is True


# ── FINDING D end-to-end: the capture webhook holds the remainder ────────────


class TestCaptureWebhookHoldsRemainder:
    """_mark_payment_paid must set escrow_held = total - already_released."""

    def test_partial_then_capture_does_not_double_count(self):
        from app.api import payments_stripe

        # A booking that already had $75 released, now Stripe confirms the $150.
        payment_row = {
            "id": "pay-1",
            "booking_id": "bk-1",
            "total_charged": 150.0,
            "total_charged_cents": 15000,
            "released_to_business": 75.0,
            "released_to_business_cents": 7500,
            "status": "partial_released",
            "stripe_payment_intent_id": None,
        }
        captured = {}

        class Tbl:
            def __init__(self, name):
                self.name = name

            def select(self, *a, **k):
                return self

            def eq(self, *a, **k):
                return self

            def single(self):
                return self

            def update(self, payload):
                captured["update"] = payload
                return self

            def execute(self):
                if self.name == "bookings":
                    return MagicMock(
                        data={"total_amount": 150.0, "total_amount_cents": 15000}
                    )
                return MagicMock(data=[payment_row])

        with patch.object(
            escrow, "load_single_payment", return_value=payment_row
        ), patch.object(
            payments_stripe, "supabase", MagicMock(table=lambda n: Tbl(n))
        ), patch(
            "app.services.email.send_payment_receipt"
        ):
            payments_stripe._mark_payment_paid(
                "bk-1", "cs_test", amount_total_cents=15000, payment_intent_id="pi_1"
            )

        upd = captured["update"]
        # The remainder, not the full charge.
        assert upd["escrow_held_cents"] == 7500
        assert upd["escrow_held"] == 75.0
        assert upd["status"] == "held"
        assert upd["stripe_payment_intent_id"] == "pi_1"
        # Invariant: held + already-released never exceeds the charge.
        assert upd["escrow_held_cents"] + 7500 <= 15000


# ── Item 12: charge-before-service triggers ──────────────────────────────────


class TestChargeAtAcceptTrigger:
    def test_creates_checkout_session_when_stripe_configured(self):
        booking = {"id": "bk-1", "total_amount_cents": 15000, "service_category": "x"}
        client = {"id": "c1", "email": "c@x.co"}
        fake_session = {"id": "cs_1", "url": "https://stripe/checkout/cs_1"}
        with patch(
            "app.services.stripe_service.create_checkout_session",
            return_value=fake_session,
        ), patch.object(escrow, "load_single_payment", return_value=None), patch.object(
            payment_triggers, "supabase", MagicMock()
        ):
            res = payment_triggers.trigger_on_accept(booking=booking, client=client)
        assert res["triggered"] is True
        assert res["checkout_url"] == "https://stripe/checkout/cs_1"
        assert res["amount_cents"] == 15000

    def test_does_not_raise_when_stripe_unconfigured(self):
        from fastapi import HTTPException

        booking = {"id": "bk-1", "total_amount_cents": 15000}
        client = {"id": "c1", "email": "c@x.co"}
        with patch(
            "app.services.stripe_service.create_checkout_session",
            side_effect=HTTPException(status_code=503, detail="no stripe"),
        ), patch.object(escrow, "load_single_payment", return_value=None), patch.object(
            payment_triggers, "supabase", MagicMock()
        ):
            res = payment_triggers.trigger_on_accept(booking=booking, client=client)
        assert res["triggered"] is False
        assert "stripe_unavailable" in res["reason"]

    def test_skips_when_already_paid(self):
        booking = {"id": "bk-1", "total_amount_cents": 15000}
        client = {"id": "c1", "email": "c@x.co"}
        paid = {"status": "held", "stripe_payment_intent_id": "pi_1"}
        with patch.object(escrow, "load_single_payment", return_value=paid):
            res = payment_triggers.trigger_on_accept(booking=booking, client=client)
        assert res["triggered"] is False
        assert res["reason"] == "already_paid"

    def test_disabled_by_env(self, monkeypatch):
        monkeypatch.setenv("CHARGE_AT_ACCEPT", "0")
        res = payment_triggers.trigger_on_accept(
            booking={"id": "bk-1", "total_amount_cents": 15000}, client={"id": "c1"}
        )
        assert res["triggered"] is False
        assert res["reason"] == "charge_at_accept_disabled"

    def test_zero_amount_is_not_charged(self):
        res = payment_triggers.trigger_on_accept(
            booking={"id": "bk-1", "total_amount_cents": 0}, client={"id": "c1"}
        )
        assert res["triggered"] is False
        assert res["reason"] == "zero_amount"


class TestChargeAtPostTrigger:
    def test_off_by_default_and_honest_about_it(self):
        res = payment_triggers.trigger_on_post(
            post={"id": "p1", "budget": 100.0}, client={"id": "c1"}
        )
        assert res["triggered"] is False
        assert res["reason"] == "charge_at_post_disabled"

    def test_even_when_enabled_it_cannot_capture_without_card_on_file(
        self, monkeypatch
    ):
        monkeypatch.setenv("CHARGE_AT_POST", "1")
        with patch.object(payment_triggers, "supabase", MagicMock()):
            res = payment_triggers.trigger_on_post(
                post={"id": "p1", "budget": 100.0}, client={"id": "c1"}
            )
        assert res["triggered"] is False
        assert res["reason"] == "no_card_on_file_mechanism"
