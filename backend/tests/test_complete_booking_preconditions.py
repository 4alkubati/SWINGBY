"""
test_complete_booking_preconditions.py — PAYMENT-MODEL.md §9 item 9.

"Completing without a confirmed date or without payment is rejected."

Before this change, PATCH /bookings/{id}/complete had NO preconditions beyond
"not already completed" — a business could accept a quote and instantly
complete it, releasing escrow with no employee, no date, and no work done.
This file pins down the two new preconditions (confirmed date, valid
payment), and that a booking meeting both preconditions completes correctly:
second_release computed via the exact-remainder ledger (not a second
rounding), and `completed_at` is actually written (it never was before).
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

BOOKING_UUID = "22222222-2222-2222-2222-222222222222"

BUSINESS_OWNER = {
    "id": "owner-1",
    "role": "business_owner",
    "first_name": "Handy",
    "last_name": "Owner",
    "email": "handy@example.com",
}


@pytest.fixture
def as_owner():
    app.dependency_overrides[get_current_user] = lambda: BUSINESS_OWNER
    yield BUSINESS_OWNER
    app.dependency_overrides.pop(get_current_user, None)


def _booking_row(**overrides):
    row = {
        "id": BOOKING_UUID,
        "client_id": "client-1",
        "business_id": "biz-1",
        "employee_id": None,
        "status": "confirmed",
        "payment_status": "held",
        "total_amount": 200.0,
        "confirmed_date": "2026-08-01T10:00:00Z",
        "service_category": "Cleaning",
    }
    row.update(overrides)
    return row


def _payment_row(**overrides):
    row = {
        "id": "pay-1",
        "booking_id": BOOKING_UUID,
        "total_charged": "200.00",
        "escrow_held": "180.00",
        "released_to_business": "0.00",
        "platform_cut": "20.00",
        "status": "held",
    }
    row.update(overrides)
    return row


def _multi_table(stubs: dict, default: SupabaseTableStub | None = None):
    def _table(name):
        return stubs.get(name, default)

    return _table


def _patch(stubs, default=None):
    patcher = patch("app.api.bookings.supabase")
    mock_supabase = patcher.start()
    mock_supabase.table.side_effect = _multi_table(stubs, default)
    return patcher


class TestNoConfirmedDatePrecondition:
    def test_completing_without_confirmed_date_is_rejected(self, test_client, as_owner):
        booking_stub = SupabaseTableStub(select_data=_booking_row(confirmed_date=None))
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        stubs = {"bookings": booking_stub, "businesses": biz_stub}
        p = _patch(stubs)
        try:
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/complete",
                headers={"Authorization": "Bearer test-token"},
            )
        finally:
            p.stop()

        assert response.status_code == 400
        assert "confirmed date" in response.json()["detail"].lower()

        # No release, no completion — the booking update never happened.
        booking_update_calls = [c for c in booking_stub.calls if c[0] == "update"]
        assert booking_update_calls == []


class TestNoConfirmedPaymentPrecondition:
    def test_completing_with_no_payment_row_is_rejected(self, test_client, as_owner):
        booking_stub = SupabaseTableStub(select_data=_booking_row())
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        payments_stub = SupabaseTableStub(select_data=None)
        stubs = {
            "bookings": booking_stub,
            "businesses": biz_stub,
            "payments": payments_stub,
        }
        p = _patch(stubs)
        try:
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/complete",
                headers={"Authorization": "Bearer test-token"},
            )
        finally:
            p.stop()

        assert response.status_code == 400
        assert "payment" in response.json()["detail"].lower()
        assert [c for c in booking_stub.calls if c[0] == "update"] == []

    def test_completing_with_pending_payment_is_rejected(self, test_client, as_owner):
        """A payment row exists but the charge hasn't cleared yet — must not
        release anything nor mark the job complete."""
        booking_stub = SupabaseTableStub(select_data=_booking_row())
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        payments_stub = SupabaseTableStub(
            select_data=_payment_row(status="pending_payment")
        )
        stubs = {
            "bookings": booking_stub,
            "businesses": biz_stub,
            "payments": payments_stub,
        }
        p = _patch(stubs)
        try:
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/complete",
                headers={"Authorization": "Bearer test-token"},
            )
        finally:
            p.stop()

        assert response.status_code == 400
        assert [c for c in booking_stub.calls if c[0] == "update"] == []
        assert [c for c in payments_stub.calls if c[0] == "update"] == []

    def test_completing_with_failed_payment_is_rejected(self, test_client, as_owner):
        booking_stub = SupabaseTableStub(select_data=_booking_row())
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        payments_stub = SupabaseTableStub(select_data=_payment_row(status="failed"))
        stubs = {
            "bookings": booking_stub,
            "businesses": biz_stub,
            "payments": payments_stub,
        }
        p = _patch(stubs)
        try:
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/complete",
                headers={"Authorization": "Bearer test-token"},
            )
        finally:
            p.stop()

        assert response.status_code == 400


class TestCompletionSucceedsWithBothPreconditionsMet:
    def test_held_payment_releases_exact_remainder_and_stamps_completed_at(
        self, test_client, as_owner
    ):
        booking_stub = SupabaseTableStub(
            select_data=_booking_row(),
            update_data=[{"id": BOOKING_UUID, "status": "completed"}],
        )
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        payments_stub = SupabaseTableStub(
            select_data=_payment_row(status="held"),
            update_data=[{"id": "pay-1", "status": "fully_released"}],
        )
        stubs = {
            "bookings": booking_stub,
            "businesses": biz_stub,
            "payments": payments_stub,
        }
        p = _patch(stubs, default=SupabaseTableStub(select_data=None))
        try:
            with patch("app.api.bookings.send_push_to_user", create=True):
                response = test_client.patch(
                    f"/bookings/{BOOKING_UUID}/complete",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        assert response.status_code == 200, response.text

        # The payments row was released via the exact-remainder ledger.
        payment_update_calls = [c for c in payments_stub.calls if c[0] == "update"]
        assert len(payment_update_calls) == 1
        payload = payment_update_calls[0][1][0]
        assert payload["status"] == "fully_released"
        assert payload["escrow_held"] == "0.00"
        # total_charged=200.00 -> platform_cut=20.00 -> business_net=180.00
        assert payload["released_to_business"] == "180.00"

        # The booking was marked completed AND completed_at was stamped —
        # previously never written at all.
        booking_update_calls = [c for c in booking_stub.calls if c[0] == "update"]
        assert len(booking_update_calls) == 1
        booking_payload = booking_update_calls[0][1][0]
        assert booking_payload["status"] == "completed"
        assert booking_payload["payment_status"] == "fully_released"
        assert "completed_at" in booking_payload
        assert booking_payload["completed_at"], "completed_at must not be empty"

    def test_partial_released_payment_also_completes(self, test_client, as_owner):
        """A booking that already had its first_release (date-confirmed
        handshake ran) must still be completable — the second release takes
        it the rest of the way to fully_released."""
        booking_stub = SupabaseTableStub(
            select_data=_booking_row(payment_status="partial_released"),
            update_data=[{"id": BOOKING_UUID, "status": "completed"}],
        )
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        payments_stub = SupabaseTableStub(
            select_data=_payment_row(
                status="partial_released",
                escrow_held="90.00",
                released_to_business="90.00",
            ),
            update_data=[{"id": "pay-1", "status": "fully_released"}],
        )
        stubs = {
            "bookings": booking_stub,
            "businesses": biz_stub,
            "payments": payments_stub,
        }
        p = _patch(stubs, default=SupabaseTableStub(select_data=None))
        try:
            with patch("app.api.bookings.send_push_to_user", create=True):
                response = test_client.patch(
                    f"/bookings/{BOOKING_UUID}/complete",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        assert response.status_code == 200, response.text
        payment_update_calls = [c for c in payments_stub.calls if c[0] == "update"]
        payload = payment_update_calls[0][1][0]
        # Re-derived from total_charged, not from the (already-correct-here)
        # prior escrow_held/released_to_business — this is the point of
        # payment_ledger.release_second_tranche never trusting prior state.
        assert payload["released_to_business"] == "180.00"
        assert payload["escrow_held"] == "0.00"
