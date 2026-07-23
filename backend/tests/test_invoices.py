"""
test_invoices.py — regression coverage for the invoice endpoints.

The reason this file exists: `GET /bookings/{id}/invoice` selected a phantom
`payments.notes` column that does not exist in the live schema, so PostgREST
rejected the query and every invoice 500'd in prod (commit 581653a). These
tests would have caught that — they assert the payments SELECT names only real
columns and that the endpoint returns 200 with the processor ref mapped from
`stripe_payment_intent_id`.
"""

from unittest.mock import patch

import pytest

from app.deps import get_current_user, get_current_user_allow_query_token
from app.main import app
from tests.conftest import SupabaseTableStub

CLIENT = {"id": "client-1", "role": "client", "first_name": "Casey"}

BOOKING_UUID = "33333333-3333-3333-3333-333333333333"

# The real `payments` columns, read off GET /payments/mine (select("*")) in prod.
# A SELECT that names anything outside this set is a phantom column.
REAL_PAYMENT_COLUMNS = {
    "booking_id",
    "created_at",
    "escrow_held",
    "id",
    "method",
    "platform_cut",
    "released_at",
    "released_to_business",
    "status",
    "stripe_payment_intent_id",
    "total_charged",
}


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _clear():
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_client():
    _override(CLIENT)
    yield CLIENT
    _clear()


def _multi_table(stubs):
    def _table(name):
        return stubs.get(name)

    return _table


def _stubs():
    booking = SupabaseTableStub(
        select_data={
            "id": BOOKING_UUID,
            "client_id": "client-1",
            "business_id": "biz-1",
            "total_amount": 180.0,
            "platform_fee": 18.0,
            "commission_rate": 0.10,
            "service_category": "Cleaning",
            "created_at": "2026-07-20T00:00:00Z",
            "businesses": {
                "business_name": "Test Cleaning Co.",
                "category": "Cleaning",
            },
        }
    )
    users = SupabaseTableStub(
        select_data={"first_name": "Casey", "last_name": "Client", "email": "c@x.dev"}
    )
    payments = SupabaseTableStub(
        select_data=[
            {
                "status": "fully_released",
                "method": "stripe_card",
                "stripe_payment_intent_id": "pi_abc123",
                "total_charged": 180.0,
                "platform_cut": 18.0,
                "released_to_business": 162.0,
            }
        ]
    )
    return booking, users, payments


class TestInvoicePhantomColumn:
    def test_invoice_loads_and_maps_processor_ref(self, test_client, as_client):
        booking, users, payments = _stubs()
        with patch("app.api.invoices.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {"bookings": booking, "users": users, "payments": payments}
            )
            resp = test_client.get(
                f"/bookings/{BOOKING_UUID}/invoice",
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        # processor_ref must come from stripe_payment_intent_id, not the old notes
        assert body["payment"]["processor_ref"] == "pi_abc123"

    def test_payments_select_names_no_phantom_column(self, test_client, as_client):
        """The exact regression: the payments SELECT must reference only real
        columns — never `notes`."""
        booking, users, payments = _stubs()
        with patch("app.api.invoices.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {"bookings": booking, "users": users, "payments": payments}
            )
            test_client.get(
                f"/bookings/{BOOKING_UUID}/invoice",
                headers={"Authorization": "Bearer test-token"},
            )
        select_calls = [c for c in payments.calls if c[0] == "select"]
        assert select_calls, "payments.select was never called"
        selected = select_calls[0][1][0]
        cols = {c.strip() for c in selected.replace("\n", " ").split(",") if c.strip()}
        assert "notes" not in cols, f"phantom column reintroduced: {cols}"
        assert "stripe_payment_intent_id" in cols
        phantom = cols - REAL_PAYMENT_COLUMNS
        assert not phantom, f"payments SELECT names non-existent columns: {phantom}"


class TestPdfQueryTokenAuth:
    """The invoice PDF is opened via the system browser, which cannot attach an
    Authorization header, so the route accepts ?token=. The JSON route must NOT."""

    def test_pdf_dep_accepts_query_token(self):
        with patch("app.deps._user_from_token", return_value=CLIENT) as spy:
            out = get_current_user_allow_query_token(
                authorization=None, token="jwt-xyz"
            )
        assert out is CLIENT
        spy.assert_called_once_with("jwt-xyz")

    def test_pdf_dep_prefers_header_over_query(self):
        with patch("app.deps._user_from_token", return_value=CLIENT) as spy:
            get_current_user_allow_query_token(
                authorization="Bearer header-jwt", token="query-jwt"
            )
        spy.assert_called_once_with("header-jwt")

    def test_pdf_dep_401_without_either(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            get_current_user_allow_query_token(authorization=None, token=None)
        assert exc.value.status_code == 401
