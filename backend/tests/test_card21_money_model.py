"""
test_card21_money_model.py — CARD-21: Uber-style money model + internal ledger.

Covers every branch of the new flow, all money math against a MOCKED Stripe
(no live STRIPE_SECRET_KEY on this box — see ~/brain/inbox/CARD-21-report.md
for the honest status of the live sandbox run, which is NOT what these tests
claim to be):

  1. accept_interest        -> booking + payment created at $0 held / $0
                                released, ledger row opened with EXPECTED
                                numbers only.
  2. webhook checkout done  -> FULL amount captured & held on the platform
                                balance (escrow_held = total). Asserts
                                released_to_business is STILL 0 — this is the
                                bug CARD-21 exists to kill.
  3. complete_booking       -> business share (total - 10% cut) released in
                                one shot. This is the ONLY point money moves
                                to the business.
  4. cancel_booking (captured case)   -> Stripe refund issued for
                                (total - penalty) out of the platform
                                balance; released_to_business untouched (was
                                already 0).
  5. cancel_booking (never-captured case) -> no Stripe refund call is made
                                (nothing was charged).
  6. money_ledger.py unit tests (pure math + mismatch detection).
  7. stripe_service.py new primitives (create_refund, create_transfer,
     retrieve_payment_intent) against a mocked Stripe SDK.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

CLIENT = {
    "id": "client-1",
    "role": "client",
    "email": "client@example.com",
    "first_name": "Jane",
}
BUSINESS_OWNER = {
    "id": "biz-owner-1",
    "role": "business_owner",
    "email": "biz@example.com",
    "first_name": "Bo",
}


class FakeSupabase:
    """
    Routes `.table(name)` calls to a per-table SupabaseTableStub. Tables not
    explicitly configured get a harmless generic stub so best-effort
    notification code (push/email lookups) never blows up the test.
    """

    def __init__(self, stubs: dict[str, SupabaseTableStub]):
        self.stubs = stubs

    def table(self, name: str) -> SupabaseTableStub:
        if name not in self.stubs:
            self.stubs[name] = SupabaseTableStub(
                select_data={}, insert_data=[{}], update_data=[{}]
            )
        return self.stubs[name]


@pytest.fixture(autouse=True)
def _no_dependency_leak():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def _silence_notifications():
    """Push/email are best-effort but touch the network — stub them out so
    tests are fast and deterministic, matching how they'd no-op in prod
    without RESEND_API_KEY / Expo tokens anyway."""
    with patch("app.api.interests.send_push_to_user"), patch(
        "app.api.bookings.send_push_to_user"
    ), patch("app.services.email.send_booking_confirmed_business"), patch(
        "app.services.email.send_booking_confirmed_client"
    ), patch("app.services.email.send_booking_completed_client"), patch(
        "app.services.email.send_booking_cancelled"
    ), patch("app.services.email.send_payment_receipt"):
        yield


# ---------------------------------------------------------------------------
# 1. accept_interest — no release at accept
# ---------------------------------------------------------------------------


class TestAcceptInterestNoRelease:
    def test_accept_creates_payment_at_zero_held_and_zero_released(self, test_client):
        app.dependency_overrides[get_current_user] = lambda: CLIENT

        stubs = {
            "interests": SupabaseTableStub(
                select_data={
                    "id": "interest-1",
                    "status": "pending",
                    "post_id": "post-1",
                    "business_id": "biz-1",
                    "quoted_price": 120.0,
                }
            ),
            "service_posts": SupabaseTableStub(
                select_data={
                    "id": "post-1",
                    "client_id": "client-1",
                    "budget": 100.0,
                    "category": "cleaning",
                    "status": "open",
                    "title": "Deep clean",
                }
            ),
            "businesses": SupabaseTableStub(
                select_data={
                    "subscription_status": "active",
                    "owner_id": "biz-owner-1",
                    "business_name": "Test Biz",
                }
            ),
            "bookings": SupabaseTableStub(
                insert_data=[
                    {
                        "id": "booking-1",
                        "client_id": "client-1",
                        "business_id": "biz-1",
                        "post_id": "post-1",
                        "total_amount": 120.0,
                        "commission_rate": 0.10,
                        "platform_fee": 12.0,
                        "status": "confirmed",
                        "payment_status": "pending",
                    }
                ]
            ),
            "payments": SupabaseTableStub(
                insert_data=[
                    {
                        "id": "payment-1",
                        "booking_id": "booking-1",
                        "total_charged": 120.0,
                        "escrow_held": 0,
                        "released_to_business": 0,
                        "platform_cut": 12.0,
                        "status": "pending",
                    }
                ]
            ),
            "users": SupabaseTableStub(select_data={"email": "biz@example.com"}),
        }
        fake = FakeSupabase(stubs)

        with patch("app.api.interests.supabase", fake), patch(
            "app.services.money_ledger.supabase", fake
        ):
            resp = test_client.patch("/interests/interest-1/accept")

        assert resp.status_code == 200, resp.text
        body = resp.json()

        # The booking write itself never claims money has moved.
        booking_write = stubs["bookings"].inserted
        assert booking_write["payment_status"] == "pending"

        # The payment write — the exact bug CARD-21 fixes: this used to be
        # escrow_held=60, released_to_business=60 (50% of 120) at accept.
        payment_write = stubs["payments"].inserted
        assert payment_write["escrow_held"] == 0
        assert payment_write["released_to_business"] == 0
        assert payment_write["status"] == "pending"
        assert payment_write["total_charged"] == 120.0
        assert payment_write["platform_cut"] == 12.0

        # Ledger row opened with EXPECTED numbers, no actuals yet.
        ledger_write = stubs["payment_ledger"].inserted
        assert ledger_write["booking_id"] == "booking-1"
        assert ledger_write["expected_total"] == 120.0
        assert ledger_write["expected_platform_cut"] == 12.0
        assert ledger_write["expected_business_share"] == 108.0
        assert ledger_write["status"] == "pending"

        assert body["payment"]["escrow_held"] == 0
        assert body["payment"]["released_to_business"] == 0


# ---------------------------------------------------------------------------
# 2. webhook checkout.session.completed — full capture, held, NOT released
# ---------------------------------------------------------------------------


class TestWebhookCapture:
    def _post_webhook(self, stubs):
        fake = FakeSupabase(stubs)
        fake_event = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_123",
                    "payment_intent": "pi_test_123",
                    "metadata": {"booking_id": "booking-1"},
                }
            },
        }
        with patch("app.api.payments_stripe.supabase", fake), patch(
            "app.services.money_ledger.supabase", fake
        ), patch(
            "app.api.payments_stripe.stripe_service.verify_webhook", return_value=fake_event
        ):
            resp = self.client.post(
                "/payments/stripe/webhook",
                content=b"{}",
                headers={"stripe-signature": "t=1,v1=fake"},
            )
        return resp, stubs

    def test_capture_holds_full_amount_never_releases(self, test_client):
        self.client = test_client
        stubs = {
            "bookings": SupabaseTableStub(
                select_data={"id": "booking-1", "client_id": "client-1", "total_amount": 120.0}
            ),
            "payments": SupabaseTableStub(
                select_data={"id": "payment-1", "total_charged": 120.0}
            ),
            "users": SupabaseTableStub(select_data={"email": "c@x.com", "first_name": "Jane"}),
            "payment_ledger": SupabaseTableStub(
                select_data={
                    "expected_total": 120.0,
                    "expected_platform_cut": 12.0,
                    "expected_business_share": 108.0,
                    "mismatch_notes": "",
                }
            ),
        }
        resp, stubs = self._post_webhook(stubs)

        assert resp.status_code == 200, resp.text

        payment_update = stubs["payments"].calls
        # find the update(...) payload
        update_payload = next(
            args[0] for (name, args, kwargs) in payment_update if name == "update"
        )
        assert update_payload["escrow_held"] == 120.0
        assert update_payload["released_to_business"] == 0
        assert update_payload["status"] == "paid_full"

        booking_update = next(
            args[0] for (name, args, kwargs) in stubs["bookings"].calls if name == "update"
        )
        assert booking_update["payment_status"] == "held"

        ledger_update = next(
            args[0]
            for (name, args, kwargs) in stubs["payment_ledger"].calls
            if name == "update"
        )
        assert ledger_update["stripe_payment_intent_id"] == "pi_test_123"
        assert ledger_update["stripe_checkout_session_id"] == "cs_test_123"
        assert ledger_update["actual_captured_amount"] == 120.0
        assert ledger_update["status"] == "captured"
        # matches expected_total exactly -> no mismatch flagged
        assert ledger_update.get("mismatch", False) is False


# ---------------------------------------------------------------------------
# 3. complete_booking — the ONLY point the business gets paid
# ---------------------------------------------------------------------------


class TestCompleteBookingReleasesOnce:
    def test_complete_releases_business_share_exactly_once(self, test_client):
        app.dependency_overrides[get_current_user] = lambda: BUSINESS_OWNER

        stubs = {
            "bookings": SupabaseTableStub(
                select_data={
                    "id": "booking-1",
                    "business_id": "biz-1",
                    "client_id": "client-1",
                    "status": "in_progress",
                }
            ),
            "businesses": SupabaseTableStub(select_data={"id": "biz-1", "business_name": "Biz"}),
            "payments": SupabaseTableStub(
                select_data={
                    "id": "payment-1",
                    "total_charged": 120.0,
                    "platform_cut": 12.0,
                    "released_to_business": 0,
                    "escrow_held": 120.0,
                    "status": "paid_full",
                }
            ),
            "users": SupabaseTableStub(select_data={"email": "c@x.com", "first_name": "Jane"}),
            "payment_ledger": SupabaseTableStub(
                select_data={"expected_business_share": 108.0, "mismatch_notes": ""}
            ),
        }
        fake = FakeSupabase(stubs)

        with patch("app.api.bookings.supabase", fake), patch(
            "app.services.money_ledger.supabase", fake
        ):
            resp = test_client.patch("/bookings/booking-1/complete")

        assert resp.status_code == 200, resp.text

        payment_update = next(
            args[0] for (name, args, kwargs) in stubs["payments"].calls if name == "update"
        )
        assert payment_update["released_to_business"] == 108.0  # 120 - 12
        assert payment_update["escrow_held"] == 0
        assert payment_update["status"] == "fully_released"

        ledger_update = next(
            args[0]
            for (name, args, kwargs) in stubs["payment_ledger"].calls
            if name == "update"
        )
        assert ledger_update["actual_business_share_released"] == 108.0
        assert ledger_update["status"] == "completed_released"


# ---------------------------------------------------------------------------
# 4 & 5. cancel_booking — refund from platform balance, never a business clawback
# ---------------------------------------------------------------------------


class TestCancelBookingRefund:
    def _cancel(self, stubs, refund_mock):
        from contextlib import ExitStack

        app.dependency_overrides[get_current_user] = lambda: CLIENT
        fake = FakeSupabase(stubs)
        with ExitStack() as stack:
            stack.enter_context(patch("app.api.bookings.supabase", fake))
            stack.enter_context(patch("app.services.money_ledger.supabase", fake))
            stack.enter_context(patch("app.services.stripe_service.create_refund", refund_mock))
            resp = self.client.patch(
                "/bookings/booking-1/cancel", json={"reason": "changed mind"}
            )
        return resp

    def test_cancel_after_capture_refunds_total_minus_penalty_via_stripe(self, test_client):
        self.client = test_client
        from datetime import datetime, timedelta, timezone

        far_future = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()

        stubs = {
            "bookings": SupabaseTableStub(
                select_data={
                    "id": "booking-1",
                    "client_id": "client-1",
                    "business_id": "biz-1",
                    "status": "confirmed",
                    "confirmed_date": far_future,
                    "total_amount": 120.0,
                }
            ),
            "cancellations": SupabaseTableStub(insert_data=[{}]),
            "payments": SupabaseTableStub(
                select_data={
                    "id": "payment-1",
                    "status": "paid_full",
                    "total_charged": 120.0,
                    "escrow_held": 120.0,
                }
            ),
            "payment_ledger": SupabaseTableStub(
                select_data={"stripe_payment_intent_id": "pi_test_123"}
            ),
            "businesses": SupabaseTableStub(select_data={"owner_id": "biz-owner-1"}),
            "users": SupabaseTableStub(select_data={"email": "c@x.com", "first_name": "Jane"}),
        }

        refund_mock = MagicMock(return_value={"id": "re_test_1", "status": "succeeded", "amount": 9000})
        resp = self._cancel(stubs, refund_mock=refund_mock)

        assert resp.status_code == 200, resp.text
        assert resp.json()["penalty_amount"] == 30.0  # 25% of 120, >48h out

        refund_mock.assert_called_once()
        _, kwargs = refund_mock.call_args
        assert kwargs["payment_intent_id"] == "pi_test_123"
        assert kwargs["amount_cad"] == 90.0  # 120 - 30 penalty

        payment_update = next(
            args[0] for (name, args, kwargs) in stubs["payments"].calls if name == "update"
        )
        assert payment_update["status"] == "refunded"
        assert payment_update["escrow_held"] == 0
        # released_to_business is NEVER touched by cancel — it was 0 before
        # (cancel is impossible once a booking is completed) and stays 0.
        assert "released_to_business" not in payment_update

        ledger_update = next(
            args[0]
            for (name, args, kwargs) in stubs["payment_ledger"].calls
            if name == "update"
        )
        assert ledger_update["stripe_refund_id"] == "re_test_1"
        assert ledger_update["actual_refund_amount"] == 90.0
        assert ledger_update["expected_penalty"] == 30.0

    def test_cancel_before_any_capture_never_calls_stripe(self, test_client):
        self.client = test_client
        stubs = {
            "bookings": SupabaseTableStub(
                select_data={
                    "id": "booking-1",
                    "client_id": "client-1",
                    "business_id": "biz-1",
                    "status": "confirmed",
                    "confirmed_date": None,
                    "total_amount": 120.0,
                }
            ),
            "cancellations": SupabaseTableStub(insert_data=[{}]),
            "payments": SupabaseTableStub(
                select_data={
                    "id": "payment-1",
                    "status": "pending",
                    "total_charged": 120.0,
                    "escrow_held": 0,
                }
            ),
            "payment_ledger": SupabaseTableStub(select_data={"stripe_payment_intent_id": None}),
            "businesses": SupabaseTableStub(select_data={"owner_id": "biz-owner-1"}),
            "users": SupabaseTableStub(select_data={"email": "c@x.com", "first_name": "Jane"}),
        }

        refund_mock = MagicMock()
        resp = self._cancel(stubs, refund_mock=refund_mock)

        assert resp.status_code == 200, resp.text
        refund_mock.assert_not_called()

        payment_update = next(
            args[0] for (name, args, kwargs) in stubs["payments"].calls if name == "update"
        )
        assert payment_update["status"] == "refunded"
        assert payment_update["escrow_held"] == 0

        ledger_update = next(
            args[0]
            for (name, args, kwargs) in stubs["payment_ledger"].calls
            if name == "update"
        )
        assert ledger_update["actual_refund_amount"] == 0.0
        assert ledger_update["stripe_refund_id"] is None


# ---------------------------------------------------------------------------
# 6. money_ledger.py — pure math + mismatch detection
# ---------------------------------------------------------------------------


class TestMoneyLedgerMath:
    def test_compute_expected_10pct_commission(self):
        from app.services import money_ledger

        result = money_ledger.compute_expected(120.0, commission_rate=0.10)
        assert result == {
            "expected_total": 120.0,
            "expected_platform_cut": 12.0,
            "expected_business_share": 108.0,
        }

    def test_compute_expected_rounds_to_cents(self):
        from app.services import money_ledger

        result = money_ledger.compute_expected(99.99, commission_rate=0.10)
        assert result["expected_platform_cut"] == 10.0  # round(9.999, 2)
        assert result["expected_business_share"] == 89.99

    def test_mismatch_flags_beyond_one_cent(self):
        from app.services import money_ledger

        mismatch, note = money_ledger._mismatch(120.00, 119.98)
        assert mismatch is True
        assert "119.98" in note

    def test_no_mismatch_within_one_cent(self):
        from app.services import money_ledger

        mismatch, note = money_ledger._mismatch(120.00, 119.99)
        assert mismatch is False
        assert note == ""

    def test_no_mismatch_exact(self):
        from app.services import money_ledger

        mismatch, note = money_ledger._mismatch(120.00, 120.00)
        assert mismatch is False

    def test_create_ledger_row_failure_is_swallowed(self):
        """A ledger insert failure must never raise to the caller — the
        booking/payment flow it observes always wins."""
        from app.services import money_ledger

        broken_supabase = MagicMock()
        broken_supabase.table.side_effect = RuntimeError("db down")
        with patch("app.services.money_ledger.supabase", broken_supabase):
            result = money_ledger.create_ledger_row(
                booking_id="b-1", payment_id="p-1", total_amount=100.0
            )
        assert result is None  # no raise


# ---------------------------------------------------------------------------
# 7. stripe_service.py — new primitives against a mocked Stripe SDK
# ---------------------------------------------------------------------------


class TestStripeServiceMoneyPrimitives:
    def test_create_refund_converts_dollars_to_cents(self):
        from app.services import stripe_service

        fake_stripe = MagicMock()
        fake_stripe.Refund.create.return_value = {
            "id": "re_1",
            "status": "succeeded",
            "amount": 9000,
        }
        with patch("app.services.stripe_service._require_stripe", return_value=fake_stripe):
            result = stripe_service.create_refund(
                payment_intent_id="pi_123", amount_cad=90.0, reason="requested_by_customer"
            )

        fake_stripe.Refund.create.assert_called_once_with(
            payment_intent="pi_123", amount=9000, reason="requested_by_customer"
        )
        assert result == {"id": "re_1", "status": "succeeded", "amount": 9000}

    def test_create_refund_rejects_zero_amount(self):
        from app.services import stripe_service
        from fastapi import HTTPException

        fake_stripe = MagicMock()
        with patch("app.services.stripe_service._require_stripe", return_value=fake_stripe):
            with pytest.raises(HTTPException) as exc_info:
                stripe_service.create_refund(payment_intent_id="pi_123", amount_cad=0)
        assert exc_info.value.status_code == 400

    def test_create_refund_without_stripe_configured_raises_503(self):
        from app.services import stripe_service

        with patch("app.services.stripe_service.settings") as mock_settings:
            mock_settings.STRIPE_SECRET_KEY = ""
            from fastapi import HTTPException

            with pytest.raises(HTTPException) as exc_info:
                stripe_service.create_refund(payment_intent_id="pi_123", amount_cad=90.0)
        assert exc_info.value.status_code == 503

    def test_create_transfer_converts_dollars_to_cents(self):
        from app.services import stripe_service

        fake_stripe = MagicMock()
        fake_stripe.Transfer.create.return_value = {"id": "tr_1", "amount": 10800}
        with patch("app.services.stripe_service._require_stripe", return_value=fake_stripe):
            result = stripe_service.create_transfer(
                destination_account_id="acct_123", amount_cad=108.0
            )

        fake_stripe.Transfer.create.assert_called_once_with(
            amount=10800, currency="cad", destination="acct_123"
        )
        assert result == {"id": "tr_1", "status": "created", "amount": 10800}

    def test_retrieve_payment_intent_returns_none_when_not_configured(self):
        from app.services import stripe_service

        with patch("app.services.stripe_service.settings") as mock_settings:
            mock_settings.STRIPE_SECRET_KEY = ""
            result = stripe_service.retrieve_payment_intent("pi_123")
        assert result is None  # best-effort, never raises

    def test_retrieve_payment_intent_shape(self):
        from app.services import stripe_service

        fake_stripe = MagicMock()
        fake_stripe.PaymentIntent.retrieve.return_value = {
            "id": "pi_123",
            "status": "succeeded",
            "amount": 12000,
            "amount_received": 12000,
            "latest_charge": "ch_1",
        }
        with patch("app.services.stripe_service._require_stripe", return_value=fake_stripe):
            result = stripe_service.retrieve_payment_intent("pi_123")
        assert result["amount_received"] == 12000
        assert result["status"] == "succeeded"
