"""
test_escrow_ledger.py — Money-path correctness for the escrow ledger fixes
(2026-07-21). Covers:

- Pure ledger math (app.services.escrow): platform cut, completion release,
  cancellation split — cents-based, no float drift.
- release_escrow_on_complete state machine (pending→released, off-platform
  no-op, missing-row raises → fix F).
- Accept no longer pre-releases money (fix: interests.py accept).
- Cancellation moves the ledger (fix D).
- Off-platform mark-paid UPDATEs the single row and never writes `notes`
  (fixes A + B).
- Stripe webhook idempotency + amount verification (fix E).
- Reporting-literal fixes (fix C: total_pending / total_earnings).
"""

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from app.services import escrow
from tests.conftest import SupabaseTableStub

# ── Pure ledger math ──────────────────────────────────────────────────────────


class TestEscrowMath:
    def test_cents_roundtrip(self):
        assert escrow.to_cents("100.00") == 10000
        assert escrow.to_cents(100) == 10000
        assert escrow.to_cents(99.99) == 9999
        assert escrow.to_dollars(9999) == 99.99

    def test_platform_cut_is_ten_percent(self):
        assert escrow.platform_cut(100.00) == 10.00
        assert escrow.platform_cut(99.99) == 10.00  # 999.9c → 1000c half-up
        assert escrow.platform_cut(0) == 0.00

    def test_completion_release_from_fresh_pending(self):
        # $100 booking, $10 cut, nothing released yet → business gets $90.
        out = escrow.compute_completion_release(100.00, 10.00, 0)
        assert out["released_to_business"] == 90.00
        assert out["escrow_held"] == 0
        assert out["final_release"] == 90.00

    def test_completion_release_is_idempotent_when_already_released(self):
        out = escrow.compute_completion_release(100.00, 10.00, 90.00)
        assert out["released_to_business"] == 90.00
        assert out["final_release"] == 0.00

    def test_cancellation_split_client_keeps_penalty(self):
        # Client cancels a $100 booking with a $25 penalty.
        out = escrow.compute_cancellation_split(
            100.00, 25.00, cancelled_by_business=False
        )
        assert out["business_keeps"] == 25.00
        assert out["client_refund"] == 75.00

    def test_cancellation_split_business_cancel_full_refund(self):
        # Business cancels → client made whole regardless of computed penalty.
        out = escrow.compute_cancellation_split(
            100.00, 50.00, cancelled_by_business=True
        )
        assert out["business_keeps"] == 0.00
        assert out["client_refund"] == 100.00

    def test_cancellation_penalty_never_exceeds_total(self):
        out = escrow.compute_cancellation_split(
            100.00, 150.00, cancelled_by_business=False
        )
        assert out["business_keeps"] == 100.00
        assert out["client_refund"] == 0.00


# ── release_escrow_on_complete state machine ──────────────────────────────────


class TestReleaseOnComplete:
    def _patch_payments(self, payment_row, update_row=None):
        stub = SupabaseTableStub(
            select_data=payment_row,
            update_data=[
                update_row or {**(payment_row or {}), "status": "fully_released"}
            ],
        )
        patcher = patch("app.services.escrow.supabase")
        m = patcher.start()
        m.table.side_effect = lambda name: stub
        return patcher, stub

    def test_pending_payment_releases_full_net(self):
        payment = {
            "id": "pay-1",
            "total_charged": 100.00,
            "platform_cut": 10.00,
            "released_to_business": 0,
            "status": "pending",
        }
        p, stub = self._patch_payments(payment)
        try:
            out = escrow.release_escrow_on_complete("booking-1")
        finally:
            p.stop()
        assert out["outcome"] == "released"
        upd = [c for c in stub.calls if c[0] == "update"][0][1][0]
        assert upd["released_to_business"] == 90.00
        assert upd["escrow_held"] == 0
        assert upd["status"] == "fully_released"

    def test_offplatform_payment_is_not_released(self):
        payment = {"id": "pay-1", "status": "paid_off_platform", "total_charged": 100.0}
        p, stub = self._patch_payments(payment)
        try:
            out = escrow.release_escrow_on_complete("booking-1")
        finally:
            p.stop()
        assert out["outcome"] == "offplatform"
        # No update issued — money never touched the platform.
        assert not [c for c in stub.calls if c[0] == "update"]

    def test_missing_payment_raises(self):
        p, _ = self._patch_payments(None)
        try:
            with pytest.raises(escrow.EscrowError):
                escrow.release_escrow_on_complete("booking-1")
        finally:
            p.stop()


# ── Endpoint: accept no longer pre-releases ───────────────────────────────────

CLIENT = {"id": "client-1", "role": "client", "first_name": "Jane", "email": "c@x.co"}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


class TestAcceptDoesNotPreRelease:
    def test_accept_holds_full_amount_releases_nothing(self, test_client, as_client):
        stubs = {
            "interests": SupabaseTableStub(
                select_data={
                    "id": "int-1",
                    "status": "pending",
                    "post_id": "post-1",
                    "business_id": "biz-1",
                    "quoted_price": 100.0,
                },
                update_data=[{"id": "int-1"}],
            ),
            "service_posts": SupabaseTableStub(
                select_data={
                    "id": "post-1",
                    "client_id": "client-1",
                    "budget": 100.0,
                    "category": "cleaning",
                    "status": "open",
                    "title": "Job",
                },
                update_data=[{"id": "post-1"}],
            ),
            "businesses": SupabaseTableStub(
                select_data={
                    "subscription_status": "trialing",
                    "owner_id": "owner-1",
                    "business_name": "Biz",
                }
            ),
            "bookings": SupabaseTableStub(insert_data=[{"id": "booking-1"}]),
            "messages": SupabaseTableStub(update_data=[]),
            "payments": SupabaseTableStub(insert_data=[{"id": "pay-1"}]),
            "users": SupabaseTableStub(
                select_data={"email": "c@x.co", "first_name": "Jane"}
            ),
        }
        patcher = patch("app.api.interests.supabase")
        m = patcher.start()
        m.table.side_effect = lambda name: stubs[name]
        try:
            with patch("app.api.interests.send_push_to_user"):
                resp = test_client.patch(
                    "/interests/int-1/accept",
                    headers={"Authorization": "Bearer t"},
                )
        finally:
            patcher.stop()

        assert resp.status_code == 200, resp.text
        pay = stubs["payments"].inserted
        assert pay["status"] == "pending"
        assert pay["released_to_business"] == 0
        assert pay["escrow_held"] == 100.0
        booking = stubs["bookings"].inserted
        assert booking["payment_status"] == "held"


# ── Endpoint: cancellation moves the ledger ───────────────────────────────────


class TestCancellationLedger:
    def test_client_cancel_far_out_keeps_25_percent(self, test_client, as_client):
        booking_row = {
            "id": "booking-1",
            "client_id": "client-1",
            "business_id": "biz-1",
            "status": "in_progress",
            "total_amount": 100.0,
            "confirmed_date": "2099-01-01T00:00:00Z",  # far future → 25% penalty
        }
        payments_stub = SupabaseTableStub(
            select_data={"id": "pay-1", "stripe_payment_intent_id": None},
            update_data=[{"id": "pay-1"}],
        )
        bstubs = {
            "bookings": SupabaseTableStub(
                select_data=booking_row, update_data=[booking_row]
            ),
            "cancellations": SupabaseTableStub(insert_data=[{"id": "can-1"}]),
            "payments": payments_stub,
            "businesses": SupabaseTableStub(select_data={"owner_id": "owner-1"}),
            "users": SupabaseTableStub(select_data=None),
        }
        p1 = patch("app.api.bookings.supabase")
        m1 = p1.start()
        m1.table.side_effect = lambda name: bstubs[name]
        p2 = patch("app.services.escrow.supabase")
        m2 = p2.start()
        m2.table.side_effect = lambda name: bstubs[name]
        try:
            with patch("app.api.bookings.send_push_to_user"):
                resp = test_client.patch(
                    "/bookings/booking-1/cancel",
                    json={"reason": "changed my mind"},
                    headers={"Authorization": "Bearer t"},
                )
        finally:
            p1.stop()
            p2.stop()

        assert resp.status_code == 200, resp.text
        assert resp.json()["penalty_amount"] == 25.00
        upd = [c for c in payments_stub.calls if c[0] == "update"][0][1][0]
        assert upd["status"] == "refunded"
        assert upd["released_to_business"] == 25.00
        assert upd["escrow_held"] == 0
        assert upd["platform_cut"] == 0


# ── Endpoint: off-platform mark-paid ──────────────────────────────────────────


class TestOffPlatformMarkPaid:
    def test_updates_single_row_and_writes_no_notes(self, test_client, as_client):
        payments_stub = SupabaseTableStub(
            select_data=[{"id": "pay-1", "status": "pending"}],
            update_data=[{"id": "pay-1", "status": "paid_off_platform"}],
        )
        stubs = {
            "bookings": SupabaseTableStub(
                select_data={
                    "id": "booking-1",
                    "client_id": "client-1",
                    "business_id": "biz-1",
                    "status": "in_progress",
                    "total_amount": 100.0,
                },
                update_data=[{"id": "booking-1"}],
            ),
            "payments": payments_stub,
            "booking_events": SupabaseTableStub(insert_data=[{"id": "evt-1"}]),
        }
        patcher = patch("app.api.payments_offplatform.supabase")
        m = patcher.start()
        m.table.side_effect = lambda name: stubs[name]
        try:
            resp = test_client.post(
                "/bookings/booking-1/mark-paid-offplatform",
                json={"method": "cash", "note": "paid in full"},
                headers={"Authorization": "Bearer t"},
            )
        finally:
            patcher.stop()

        assert resp.status_code == 200, resp.text
        update_calls = [c for c in payments_stub.calls if c[0] == "update"]
        insert_calls = [c for c in payments_stub.calls if c[0] == "insert"]
        assert len(update_calls) == 1  # UPDATE the existing row
        assert len(insert_calls) == 0  # NOT a second insert (fix B duplicate)
        payload = update_calls[0][1][0]
        assert "notes" not in payload  # fix A: no phantom column
        assert payload["status"] == "paid_off_platform"
        assert payload["platform_cut"] == 0

    def test_rejects_already_settled(self, test_client, as_client):
        payments_stub = SupabaseTableStub(
            select_data=[{"id": "pay-1", "status": "fully_released"}]
        )
        stubs = {
            "bookings": SupabaseTableStub(
                select_data={
                    "id": "booking-1",
                    "client_id": "client-1",
                    "business_id": "biz-1",
                    "status": "completed",
                    "total_amount": 100.0,
                }
            ),
            "payments": payments_stub,
        }
        patcher = patch("app.api.payments_offplatform.supabase")
        m = patcher.start()
        m.table.side_effect = lambda name: stubs[name]
        try:
            resp = test_client.post(
                "/bookings/booking-1/mark-paid-offplatform",
                json={"method": "cash"},
                headers={"Authorization": "Bearer t"},
            )
        finally:
            patcher.stop()
        assert resp.status_code == 400


# ── Stripe webhook idempotency + amount verification ──────────────────────────


class TestWebhookIdempotency:
    def test_duplicate_event_is_skipped(self, test_client):
        # stripe_events select returns a row → duplicate.
        stub = SupabaseTableStub(select_data=[{"event_id": "evt_1"}])
        patcher = patch("app.api.payments_stripe.supabase")
        m = patcher.start()
        m.table.side_effect = lambda name: stub
        verify = patch(
            "app.services.stripe_service.verify_webhook",
            return_value={
                "id": "evt_1",
                "type": "checkout.session.completed",
                "data": {"object": {"id": "cs_1", "metadata": {"booking_id": "b1"}}},
            },
        )
        verify.start()
        try:
            resp = test_client.post(
                "/payments/stripe/webhook",
                data=b"{}",
                headers={"stripe-signature": "sig"},
            )
        finally:
            patcher.stop()
            verify.stop()
        assert resp.status_code == 200
        assert resp.json().get("duplicate") is True

    def test_amount_mismatch_does_not_mark_paid(self):
        from app.api import payments_stripe

        # The booking lookup happens through payments_stripe.supabase.
        stub = SupabaseTableStub(select_data={"total_amount": 100.0})
        patcher = patch("app.api.payments_stripe.supabase")
        m = patcher.start()
        m.table.side_effect = lambda name: stub
        try:
            # Stripe says 50.00 paid but booking is 100.00 → must NOT mark paid
            # (returns before ever loading/updating the payments row).
            payments_stripe._mark_payment_paid(
                "b1", "cs_1", amount_total_cents=5000, payment_intent_id="pi_1"
            )
        finally:
            patcher.stop()
        # No update issued to payments.
        assert not [c for c in stub.calls if c[0] == "update"]


# ── Reporting-literal fixes (fix C) ───────────────────────────────────────────


class TestReportingLiterals:
    def test_total_pending_sums_held_statuses(self, test_client, as_client):
        items = [
            {"released_to_business": 0, "escrow_held": 100.0, "status": "pending"},
            {"released_to_business": 0, "escrow_held": 50.0, "status": "paid_full"},
            {
                "released_to_business": 90.0,
                "escrow_held": 0,
                "status": "fully_released",
            },
            {"released_to_business": 0, "escrow_held": 20.0, "status": "refunded"},
        ]
        stubs = {
            "bookings": SupabaseTableStub(select_data=[{"id": "booking-1"}]),
            "payments": SupabaseTableStub(select_data=items),
        }
        patcher = patch("app.api.payments.supabase")
        m = patcher.start()
        m.table.side_effect = lambda name: stubs[name]
        try:
            resp = test_client.get(
                "/payments/mine", headers={"Authorization": "Bearer t"}
            )
        finally:
            patcher.stop()
        assert resp.status_code == 200, resp.text
        body = resp.json()
        # pending(100) + paid_full(50) held; fully_released/refunded excluded.
        assert body["total_pending"] == 150.0
        assert body["total_released"] == 90.0
