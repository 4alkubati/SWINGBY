"""
test_payment_state.py — money truth on the booking read paths (audit L5/L6).

THE BUG (Kira's walkthrough, 2026-07-24): the business dashboard and the client
booking screen both showed "$150 held in escrow" / "Confirmed — pending payment
$150" for bookings where no card was ever charged. Both were rendering
`bookings.total_amount` — the AGREED PRICE — under escrow copy. A booking row
cannot say whether money moved.

THE FIX: GET /bookings/ and GET /bookings/{id} now carry an explicit
`payment_state` block derived from the payments ledger, with `amount_due`
(owed, not moved) separated from `amount_held` (captured, in escrow). The
invariant these tests pin:

    amount_held > 0  ⟹  a real Stripe capture (or a recorded off-platform
                        payment) stands behind it.

Anything else — no payments row, a row that merely SAYS 'held' with no
PaymentIntent, a failed ledger read — reports amount_held = 0, state "unpaid".
"""

from unittest.mock import patch

import pytest

from app.api.bookings import _payment_state
from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

BOOKING = {
    "id": "booking-1",
    "client_id": "client-1",
    "business_id": "biz-1",
    "total_amount": 150.0,
    "total_amount_cents": 15000,
    "status": "confirmed",
    "payment_status": "pending_payment",
}

CLIENT = {"id": "client-1", "role": "client", "email": "jane@example.com"}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


# ── The unit: _payment_state ────────────────────────────────────────────────


class TestPaymentStateUnit:
    def test_accept_time_row_is_unpaid_not_escrow(self):
        """Exactly what interests.accept writes: owed, nothing captured."""
        payment = {
            "booking_id": "booking-1",
            "status": "pending_payment",
            "total_charged_cents": 15000,
            "escrow_held_cents": 0,
            "released_to_business_cents": 0,
            "stripe_payment_intent_id": None,
        }
        state = _payment_state(BOOKING, payment)
        assert state["state"] == "unpaid"
        assert state["label"] == "Payment due"
        assert state["amount_held"] == 0
        assert state["amount_due"] == 150.0
        assert state["capture_backed"] is False

    def test_legacy_row_claiming_held_with_no_intent_reports_zero_held(self):
        """FINDING C's data shape: the ledger says 'held', Stripe says nothing.

        Production is full of these. The old dashboard added them straight into
        "money in flight". They are worth $0 until a PaymentIntent exists.
        """
        payment = {
            "booking_id": "booking-1",
            "status": "held",
            "escrow_held_cents": 15000,
            "released_to_business_cents": 0,
            "stripe_payment_intent_id": None,
        }
        state = _payment_state(BOOKING, payment)
        assert state["state"] == "unpaid"
        assert state["amount_held"] == 0
        assert state["amount_due"] == 150.0

    def test_captured_row_reports_real_escrow(self):
        payment = {
            "booking_id": "booking-1",
            "status": "held",
            "escrow_held_cents": 15000,
            "released_to_business_cents": 0,
            "stripe_payment_intent_id": "pi_123",
        }
        state = _payment_state(BOOKING, payment)
        assert state["state"] == "held"
        assert state["label"] == "Held in escrow"
        assert state["amount_held"] == 150.0
        assert state["amount_due"] == 0
        assert state["capture_backed"] is True

    def test_released_row(self):
        payment = {
            "booking_id": "booking-1",
            "status": "fully_released",
            "escrow_held_cents": 0,
            "released_to_business_cents": 13500,
            "stripe_payment_intent_id": "pi_123",
        }
        state = _payment_state(BOOKING, payment)
        assert state["state"] == "released"
        assert state["amount_released"] == 135.0
        assert state["amount_held"] == 0
        assert state["amount_due"] == 0

    def test_phantom_payout_row_is_not_shown_as_money_that_moved(self):
        """FINDING C: 24 production rows read 'fully_released' with no charge.

        The business was 'paid' $4,675.50 nobody ever collected. Those rows are
        legacy data and are not rewritten here — but a booking screen must not
        present them as settled money.
        """
        payment = {
            "booking_id": "booking-1",
            "status": "fully_released",
            "released_to_business_cents": 13500,
            "stripe_payment_intent_id": None,
        }
        state = _payment_state(BOOKING, payment)
        assert state["state"] == "unpaid"
        assert state["amount_released"] == 0
        assert state["amount_held"] == 0
        assert state["capture_backed"] is False

    def test_off_platform_row_holds_nothing_and_owes_nothing(self):
        payment = {
            "booking_id": "booking-1",
            "status": "paid_off_platform",
            "method": "cash",
            "escrow_held_cents": 0,
            "released_to_business_cents": 0,
        }
        state = _payment_state(BOOKING, payment)
        assert state["state"] == "paid_off_platform"
        assert state["amount_held"] == 0
        assert state["amount_due"] == 0

    def test_refunded_row(self):
        payment = {"booking_id": "booking-1", "status": "refunded"}
        state = _payment_state(BOOKING, payment)
        assert state["state"] == "refunded"
        assert state["amount_held"] == 0
        assert state["amount_due"] == 0

    def test_missing_payments_row_fails_closed_to_unpaid(self):
        state = _payment_state(BOOKING, None)
        assert state["state"] == "unpaid"
        assert state["amount_held"] == 0
        assert state["amount_due"] == 150.0

    def test_booking_with_no_cents_column_falls_back_to_dollars(self):
        booking = {"id": "b", "total_amount": 99.5}
        state = _payment_state(booking, None)
        assert state["amount_total_cents"] == 9950
        assert state["amount_due"] == 99.5


# ── The route: GET /bookings/ and GET /bookings/{id} ────────────────────────


def _multi_table(stubs: dict):
    def _table(name):
        return stubs[name]

    return _table


class TestBookingReadsCarryPaymentState:
    def test_list_bookings_attaches_state(self, test_client, as_client):
        bookings_stub = SupabaseTableStub(select_data=[dict(BOOKING)])
        payments_stub = SupabaseTableStub(
            select_data=[
                {
                    "booking_id": "booking-1",
                    "status": "pending_payment",
                    "escrow_held_cents": 0,
                    "stripe_payment_intent_id": None,
                }
            ]
        )
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": bookings_stub, "payments": payments_stub}
            )
            response = test_client.get(
                "/bookings/", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        item = response.json()["items"][0]
        assert item["payment_state"]["state"] == "unpaid"
        assert item["payment_state"]["amount_held"] == 0
        assert item["payment_state"]["amount_due"] == 150.0

    def test_get_booking_attaches_state(self, test_client, as_client):
        bookings_stub = SupabaseTableStub(select_data=dict(BOOKING))
        payments_stub = SupabaseTableStub(
            select_data=[
                {
                    "booking_id": "booking-1",
                    "status": "held",
                    "escrow_held_cents": 15000,
                    "stripe_payment_intent_id": "pi_live",
                }
            ]
        )
        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": bookings_stub, "payments": payments_stub}
            )
            response = test_client.get(
                "/bookings/booking-1", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        state = response.json()["payment_state"]
        assert state["state"] == "held"
        assert state["amount_held"] == 150.0
        assert state["capture_backed"] is True

    def test_ledger_read_failure_never_claims_escrow(self, test_client, as_client):
        """A payments lookup that blows up must not leave the old lie standing."""
        bookings_stub = SupabaseTableStub(select_data=[dict(BOOKING)])

        class Exploding(SupabaseTableStub):
            def execute(self):  # pragma: no cover - trivial
                raise RuntimeError("postgrest is down")

        with patch("app.api.bookings.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": bookings_stub, "payments": Exploding()}
            )
            response = test_client.get(
                "/bookings/", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        state = response.json()["items"][0]["payment_state"]
        assert state["state"] == "unpaid"
        assert state["amount_held"] == 0
