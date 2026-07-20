"""
test_money_paths_failures.py — CARD-23 GOAL 2 (audit B8 — thin-tests).

~27 backend tests covered 35 routes with mostly happy-path coverage (audit
fault E5 — "pass-inflation"). This file adds at least one FAILURE-path test
per money/trust-critical route: wrong-role, wrong-owner, wrong-state, and
duplicate/idempotency guards. Money and trust live here — a passing happy
path proves nothing about what happens when the caller isn't who they claim,
or the booking isn't in the state the route assumes.

Routes covered (failure path unless noted):
- PATCH /bookings/{id}/cancel            — non-participant blocked, already-cancelled blocked
- PATCH /bookings/{id}/complete          — wrong role, wrong business, unassigned employee, already-completed
- PATCH /bookings/{id}/assign-employee   — wrong role, foreign booking, inactive employee
- POST  /payments/stripe/checkout/{id}   — non-owner client blocked, cancelled booking blocked, zero-amount blocked
- POST  /payments/stripe/webhook         — malformed event does not 500 (idempotent no-op)
- POST  /bookings/{id}/mark-paid-offplatform — non-client blocked, not-completed blocked, already-paid blocked, bad method rejected
- POST  /disputes/                       — bad issue_type blocked, non-party blocked, duplicate-open-dispute blocked
- PATCH /disputes/{id}/resolve           — non-admin blocked, missing dispute 404s
- POST  /bookings/{id}/events            — bad event_type blocked, non-provider blocked

Untested remainder is named honestly in the CARD-23 report, not here.
"""

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

CLIENT = {
    "id": "client-1",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Client",
    "email": "jane@example.com",
}

OTHER_CLIENT = {
    "id": "client-2",
    "role": "client",
    "first_name": "Bob",
    "last_name": "Other",
    "email": "bob@example.com",
}

BUSINESS_OWNER = {
    "id": "owner-1",
    "role": "business_owner",
    "first_name": "Handy",
    "last_name": "Owner",
    "email": "handy@example.com",
}

OTHER_BUSINESS_OWNER = {
    "id": "owner-2",
    "role": "business_owner",
    "first_name": "Other",
    "last_name": "Owner",
    "email": "other@example.com",
}

EMPLOYEE = {
    "id": "employee-user-1",
    "role": "employee",
    "first_name": "Emp",
    "last_name": "Loyee",
    "email": "emp@example.com",
}

ADMIN = {
    "id": "admin-1",
    "role": "admin",
    "first_name": "Ad",
    "last_name": "Min",
    "email": "admin@example.com",
}

BOOKING_UUID = "22222222-2222-2222-2222-222222222222"
DISPUTE_UUID = "33333333-3333-3333-3333-333333333333"


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _clear_override():
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_client():
    _override(CLIENT)
    yield CLIENT
    _clear_override()


@pytest.fixture
def as_other_client():
    _override(OTHER_CLIENT)
    yield OTHER_CLIENT
    _clear_override()


@pytest.fixture
def as_owner():
    _override(BUSINESS_OWNER)
    yield BUSINESS_OWNER
    _clear_override()


@pytest.fixture
def as_other_owner():
    _override(OTHER_BUSINESS_OWNER)
    yield OTHER_BUSINESS_OWNER
    _clear_override()


@pytest.fixture
def as_employee():
    _override(EMPLOYEE)
    yield EMPLOYEE
    _clear_override()


@pytest.fixture
def as_admin():
    _override(ADMIN)
    yield ADMIN
    _clear_override()


def _multi_table(stubs: dict, default: SupabaseTableStub = None):
    def _table(name):
        return stubs.get(name, default)

    return _table


def _booking_row(**overrides):
    row = {
        "id": BOOKING_UUID,
        "client_id": "client-1",
        "business_id": "biz-1",
        "employee_id": None,
        "status": "confirmed",
        "payment_status": "partial_released",
        "total_amount": 200.0,
        "confirmed_date": None,
        "service_category": "Cleaning",
    }
    row.update(overrides)
    return row


# ── PATCH /bookings/{id}/cancel ─────────────────────────────────────────────


class TestCancelBookingFailures:
    def test_non_participant_blocked(self, test_client, as_other_client):
        """Neither the booking's client nor its business — 403, not a silent 200."""
        booking_stub = SupabaseTableStub(select_data=_booking_row())
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/cancel",
                json={"reason": "changed my mind"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 403

    def test_already_cancelled_booking_rejected(self, test_client, as_client):
        booking_stub = SupabaseTableStub(select_data=_booking_row(status="cancelled"))
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/cancel",
                json={"reason": "too late"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 400

    def test_already_completed_booking_rejected(self, test_client, as_client):
        booking_stub = SupabaseTableStub(select_data=_booking_row(status="completed"))
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/cancel",
                json={"reason": "too late"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 400

    def test_missing_booking_404s(self, test_client, as_client):
        booking_stub = SupabaseTableStub(select_data=None)
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/cancel",
                json={},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 404


# ── PATCH /bookings/{id}/complete ───────────────────────────────────────────


class TestCompleteBookingFailures:
    def test_client_role_blocked(self, test_client, as_client):
        """Only business owner / employee can mark complete — clients cannot
        self-release their own escrow."""
        response = test_client.patch(
            f"/bookings/{BOOKING_UUID}/complete",
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 403

    def test_already_completed_rejected(self, test_client, as_owner):
        booking_stub = SupabaseTableStub(select_data=_booking_row(status="completed"))
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/complete",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 400

    def test_business_owner_of_a_different_business_blocked(
        self, test_client, as_owner
    ):
        """Booking belongs to business 'biz-1'; caller owns a different business
        — must not be able to release someone else's escrow."""
        booking_stub = SupabaseTableStub(select_data=_booking_row(status="confirmed"))
        biz_stub = SupabaseTableStub(select_data={"id": "biz-999"})
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "businesses": biz_stub}
            )
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/complete",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 403

    def test_unassigned_employee_blocked(self, test_client, as_employee):
        booking_stub = SupabaseTableStub(
            select_data=_booking_row(status="confirmed", employee_id="emp-999")
        )
        emp_stub = SupabaseTableStub(select_data={"id": "emp-1"})
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "employees": emp_stub}
            )
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/complete",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 403

    def test_missing_booking_404s(self, test_client, as_owner):
        booking_stub = SupabaseTableStub(select_data=None)
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/complete",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 404


# ── PATCH /bookings/{id}/assign-employee ────────────────────────────────────


class TestAssignEmployeeFailures:
    def test_client_role_blocked(self, test_client, as_client):
        response = test_client.patch(
            f"/bookings/{BOOKING_UUID}/assign-employee",
            json={"employee_id": "emp-1"},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 403

    def test_foreign_booking_blocked(self, test_client, as_owner):
        """Booking belongs to a different business — must not be assignable."""
        booking_stub = SupabaseTableStub(select_data=_booking_row(business_id="biz-999"))
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "businesses": biz_stub}
            )
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/assign-employee",
                json={"employee_id": "emp-1"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 403

    def test_inactive_employee_rejected(self, test_client, as_owner):
        booking_stub = SupabaseTableStub(select_data=_booking_row(business_id="biz-1"))
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        emp_stub = SupabaseTableStub(select_data={"id": "emp-1", "is_active": False})
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "businesses": biz_stub, "employees": emp_stub}
            )
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/assign-employee",
                json={"employee_id": "emp-1"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 400

    def test_employee_not_in_business_404s(self, test_client, as_owner):
        booking_stub = SupabaseTableStub(select_data=_booking_row(business_id="biz-1"))
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        emp_stub = SupabaseTableStub(select_data=None)
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "businesses": biz_stub, "employees": emp_stub}
            )
            response = test_client.patch(
                f"/bookings/{BOOKING_UUID}/assign-employee",
                json={"employee_id": "emp-nope"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 404


# ── POST /payments/stripe/checkout/{id} ─────────────────────────────────────


class TestStripeCheckoutFailures:
    def test_non_owner_client_blocked(self, test_client, as_other_client):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "total_amount": 200.0,
                "service_category": "Cleaning",
                "status": "confirmed",
            }
        )
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.post(
                f"/payments/stripe/checkout/{BOOKING_UUID}",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 403

    def test_cancelled_booking_blocked(self, test_client, as_client):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "total_amount": 200.0,
                "service_category": "Cleaning",
                "status": "cancelled",
            }
        )
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.post(
                f"/payments/stripe/checkout/{BOOKING_UUID}",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 400

    def test_zero_amount_booking_blocked(self, test_client, as_client):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "total_amount": 0,
                "service_category": "Cleaning",
                "status": "confirmed",
            }
        )
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.post(
                f"/payments/stripe/checkout/{BOOKING_UUID}",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 400

    def test_missing_booking_404s(self, test_client, as_client):
        booking_stub = SupabaseTableStub(select_data=None)
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.post(
                f"/payments/stripe/checkout/{BOOKING_UUID}",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 404


# ── POST /payments/stripe/webhook ───────────────────────────────────────────


class TestStripeWebhookFailures:
    def test_completed_event_missing_metadata_does_not_500(self, test_client):
        """
        A checkout.session.completed event with neither booking_id nor
        business_id in metadata must not crash the webhook — Stripe retries
        on non-2xx, and a 500 here would retry-storm. It should ack 200 and
        just log a warning.
        """
        fake_event = {
            "type": "checkout.session.completed",
            "data": {"object": {"id": "cs_test_123", "metadata": {}}},
        }
        with patch("app.api.payments_stripe.stripe_service") as mock_stripe:
            mock_stripe.verify_webhook.return_value = fake_event
            response = test_client.post(
                "/payments/stripe/webhook",
                json={},
                headers={"Stripe-Signature": "t=1,v1=fake"},
            )
        assert response.status_code == 200
        assert response.json()["received"] is True

    def test_unrecognized_event_type_acked_not_crashed(self, test_client):
        fake_event = {"type": "some.unhandled.event", "data": {"object": {}}}
        with patch("app.api.payments_stripe.stripe_service") as mock_stripe:
            mock_stripe.verify_webhook.return_value = fake_event
            response = test_client.post(
                "/payments/stripe/webhook",
                json={},
                headers={"Stripe-Signature": "t=1,v1=fake"},
            )
        assert response.status_code == 200


# ── POST /bookings/{id}/mark-paid-offplatform ───────────────────────────────


class TestMarkPaidOffplatformFailures:
    def test_non_client_blocked(self, test_client, as_owner):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "business_id": "biz-1",
                "status": "completed",
                "total_amount": 200.0,
            }
        )
        with patch("app.api.payments_offplatform.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.post(
                f"/bookings/{BOOKING_UUID}/mark-paid-offplatform",
                json={"method": "cash"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 403

    def test_not_completed_booking_blocked(self, test_client, as_client):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "business_id": "biz-1",
                "status": "confirmed",
                "total_amount": 200.0,
            }
        )
        with patch("app.api.payments_offplatform.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.post(
                f"/bookings/{BOOKING_UUID}/mark-paid-offplatform",
                json={"method": "cash"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 400

    def test_already_paid_booking_blocked(self, test_client, as_client):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "business_id": "biz-1",
                "status": "completed",
                "total_amount": 200.0,
            }
        )
        payments_stub = SupabaseTableStub(
            select_data=[{"id": "pay-1", "status": "fully_released"}]
        )
        with patch("app.api.payments_offplatform.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "payments": payments_stub}
            )
            response = test_client.post(
                f"/bookings/{BOOKING_UUID}/mark-paid-offplatform",
                json={"method": "cash"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 400

    def test_invalid_method_rejected_by_validation(self, test_client, as_client):
        """Pydantic validator rejects anything outside cash/e_transfer/other
        before a single DB call is made."""
        response = test_client.post(
            f"/bookings/{BOOKING_UUID}/mark-paid-offplatform",
            json={"method": "e-transfer-but-typo'd"},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422


# ── POST /disputes/ ──────────────────────────────────────────────────────────


class TestCreateDisputeFailures:
    def test_bad_issue_type_rejected(self, test_client, as_client):
        response = test_client.post(
            "/disputes/",
            json={
                "booking_id": BOOKING_UUID,
                "issue_type": "not_a_real_type",
                "description": "This is a long enough description.",
            },
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 400

    def test_non_party_blocked(self, test_client, as_other_client):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "business_id": "biz-1",
            }
        )
        with patch("app.api.disputes.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.post(
                "/disputes/",
                json={
                    "booking_id": BOOKING_UUID,
                    "issue_type": "no_show",
                    "description": "This is a long enough description.",
                },
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 403

    def test_duplicate_open_dispute_blocked(self, test_client, as_client):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "business_id": "biz-1",
            }
        )
        disputes_stub = SupabaseTableStub(
            select_data=[{"id": "dispute-old", "status": "open"}]
        )
        with patch("app.api.disputes.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "disputes": disputes_stub}
            )
            response = test_client.post(
                "/disputes/",
                json={
                    "booking_id": BOOKING_UUID,
                    "issue_type": "no_show",
                    "description": "This is a long enough description.",
                },
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 409

    def test_missing_booking_404s(self, test_client, as_client):
        booking_stub = SupabaseTableStub(select_data=None)
        with patch("app.api.disputes.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.post(
                "/disputes/",
                json={
                    "booking_id": BOOKING_UUID,
                    "issue_type": "no_show",
                    "description": "This is a long enough description.",
                },
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 404


# ── PATCH /disputes/{id}/resolve ────────────────────────────────────────────


class TestResolveDisputeFailures:
    def test_non_admin_blocked(self, test_client, as_owner):
        response = test_client.patch(
            f"/disputes/{DISPUTE_UUID}/resolve",
            json={"resolution": "Refund issued"},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 403

    def test_client_role_blocked(self, test_client, as_client):
        """A client — even the one who opened the dispute — cannot resolve it."""
        response = test_client.patch(
            f"/disputes/{DISPUTE_UUID}/resolve",
            json={"resolution": "Refund issued"},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 403

    def test_missing_dispute_404s(self, test_client, as_admin):
        disputes_stub = SupabaseTableStub(update_data=[])
        with patch("app.api.disputes.supabase") as mock_supabase:
            mock_supabase.table.return_value = disputes_stub
            response = test_client.patch(
                f"/disputes/{DISPUTE_UUID}/resolve",
                json={"resolution": "Refund issued"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 404


# ── POST /bookings/{id}/events ───────────────────────────────────────────────


class TestCreateBookingEventFailures:
    def test_bad_event_type_rejected(self, test_client, as_owner):
        response = test_client.post(
            f"/bookings/{BOOKING_UUID}/events",
            json={"event_type": "made_up_status"},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 400

    def test_client_cannot_post_provider_events(self, test_client, as_client):
        """Live Job Status events are provider-authored — a client posting
        their own 'arrived' event would forge the trust timeline."""
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "business_id": "biz-1",
                "employee_id": None,
                "status": "confirmed",
            }
        )
        with patch("app.api.booking_events.supabase") as mock_supabase:
            mock_supabase.table.return_value = booking_stub
            response = test_client.post(
                f"/bookings/{BOOKING_UUID}/events",
                json={"event_type": "arrived"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 403

    def test_foreign_business_owner_blocked(self, test_client, as_other_owner):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": BOOKING_UUID,
                "client_id": "client-1",
                "business_id": "biz-1",
                "employee_id": None,
                "status": "confirmed",
            }
        )
        biz_stub = SupabaseTableStub(select_data={"id": "biz-999"})
        with patch("app.api.booking_events.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "businesses": biz_stub}
            )
            response = test_client.post(
                f"/bookings/{BOOKING_UUID}/events",
                json={"event_type": "en_route"},
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 403
