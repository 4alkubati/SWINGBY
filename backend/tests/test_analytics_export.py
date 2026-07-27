"""
test_analytics_export.py — GET /analytics/export (CSV/JSON revenue export).

Covers the requirements from the export brief:
  - a business owner exports only THEIR OWN rows, never another business's
    (there is no business_id param at all — ownership is resolved from the
    caller's id, so this is tested by proving the ownership lookup is always
    scoped to the CALLING user, not a value anyone could supply)
  - CSV injection (a leading =, +, -, @ in a user-supplied field) is
    neutralised with a leading single quote
  - refunds reduce the reported revenue figure — an export that used
    total_charged as "revenue" would overstate it
  - an empty range / a business with no bookings returns valid headers-only
    output, never a 404 or a crash
"""

import csv
import io
from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

OWNER_A = {"id": "owner-a", "role": "business_owner", "first_name": "Alex"}
OWNER_B = {"id": "owner-b", "role": "business_owner", "first_name": "Bailey"}
CLIENT = {"id": "client-1", "role": "client", "first_name": "Casey"}


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # The limiter is keyed by client IP ("testclient" for every TestClient
    # request), so consecutive tests in this file would otherwise trip the
    # endpoint's own 10/minute cap. Matches the pattern in test_auth.py /
    # test_account_lifecycle.py.
    app.state.limiter.reset()
    yield
    app.state.limiter.reset()


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _clear():
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_owner_a():
    _override(OWNER_A)
    yield OWNER_A
    _clear()


@pytest.fixture
def as_owner_b():
    _override(OWNER_B)
    yield OWNER_B
    _clear()


@pytest.fixture
def as_client():
    _override(CLIENT)
    yield CLIENT
    _clear()


def _multi_table(stubs):
    def _table(name):
        return stubs.get(name, SupabaseTableStub(select_data=[]))

    return _table


def _rows_to_csv_dicts(text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(text)))


class TestOwnershipIsolation:
    """No business_id parameter exists — the export can only ever resolve the
    CALLER's own business. These tests pin that the ownership lookup is keyed
    off current_user['id'], never anything supplied by the request."""

    def test_business_lookup_filters_by_the_calling_owner(
        self, test_client, as_owner_a
    ):
        biz = SupabaseTableStub(select_data={"id": "biz-a"})
        bookings = SupabaseTableStub(select_data=[])
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {"businesses": biz, "bookings": bookings}
            )
            resp = test_client.get(
                "/analytics/export?format=json",
                headers={"Authorization": "Bearer t"},
            )
        assert resp.status_code == 200, resp.text
        eq_calls = [c for c in biz.calls if c[0] == "eq"]
        assert eq_calls, "businesses.eq was never called"
        assert eq_calls[0][1] == ("owner_id", "owner-a")

    def test_different_owner_gets_their_own_scope_not_a_shared_default(
        self, test_client, as_owner_b
    ):
        biz = SupabaseTableStub(select_data={"id": "biz-b"})
        bookings = SupabaseTableStub(select_data=[])
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {"businesses": biz, "bookings": bookings}
            )
            resp = test_client.get(
                "/analytics/export?format=json",
                headers={"Authorization": "Bearer t"},
            )
        assert resp.status_code == 200, resp.text
        eq_calls = [c for c in biz.calls if c[0] == "eq"]
        assert eq_calls[0][1] == ("owner_id", "owner-b")

    def test_bookings_query_is_scoped_to_the_resolved_business_id(
        self, test_client, as_owner_a
    ):
        biz = SupabaseTableStub(select_data={"id": "biz-a"})
        bookings = SupabaseTableStub(select_data=[])
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {"businesses": biz, "bookings": bookings}
            )
            test_client.get(
                "/analytics/export?format=json", headers={"Authorization": "Bearer t"}
            )
        eq_calls = [c for c in bookings.calls if c[0] == "eq"]
        assert eq_calls[0][1] == ("business_id", "biz-a")

    def test_non_business_owner_is_rejected(self, test_client, as_client):
        resp = test_client.get(
            "/analytics/export?format=json", headers={"Authorization": "Bearer t"}
        )
        assert resp.status_code == 403

    def test_no_business_for_account_is_404_not_a_crash(self, test_client, as_owner_a):
        biz = SupabaseTableStub(select_data=None)
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table({"businesses": biz})
            resp = test_client.get(
                "/analytics/export?format=json", headers={"Authorization": "Bearer t"}
            )
        assert resp.status_code == 404


def _stubs_with_one_booking(payment_overrides=None, client_first_name="Jordan"):
    biz = SupabaseTableStub(select_data={"id": "biz-a"})
    bookings = SupabaseTableStub(
        select_data=[
            {
                "id": "bk-1",
                "created_at": "2026-06-01T00:00:00Z",
                "service_category": "Cleaning",
                "client_id": "client-9",
            }
        ]
    )
    payment = {
        "booking_id": "bk-1",
        "created_at": "2026-06-01T00:00:00Z",
        "status": "fully_released",
        # off-platform method => escrow.is_capture_backed() is True regardless
        # of Stripe fields (real money changed hands directly with the
        # client) — this is the same "capture backed" gate
        # GET /businesses/me/analytics uses to decide total_earnings vs
        # unverified_earnings (FINDING C).
        "method": "cash",
        "stripe_payment_intent_id": None,
        "total_charged_cents": 15000,
        "released_to_business_cents": 9000,
        "platform_cut_cents": 1000,
        "escrow_held_cents": 0,
        "refunded_cents": 5000,
    }
    if payment_overrides:
        payment.update(payment_overrides)
    payments = SupabaseTableStub(select_data=[payment])
    users = SupabaseTableStub(
        select_data=[
            {"id": "client-9", "first_name": client_first_name, "last_name": ""}
        ]
    )
    return biz, bookings, payments, users


class TestCsvInjectionNeutralised:
    def test_leading_equals_in_client_name_is_prefixed(self, test_client, as_owner_a):
        biz, bookings, payments, users = _stubs_with_one_booking(
            client_first_name="=cmd|' /C calc'!A1"
        )
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "businesses": biz,
                    "bookings": bookings,
                    "payments": payments,
                    "users": users,
                }
            )
            resp = test_client.get(
                "/analytics/export?format=csv", headers={"Authorization": "Bearer t"}
            )
        assert resp.status_code == 200, resp.text
        rows = _rows_to_csv_dicts(resp.text)
        assert len(rows) == 1
        assert rows[0]["client_name"].startswith("'=")
        assert rows[0]["client_name"] == "'=cmd|' /C calc'!A1"

    @pytest.mark.parametrize("prefix", ["=", "+", "-", "@"])
    def test_all_dangerous_prefixes_are_neutralised(
        self, test_client, as_owner_a, prefix
    ):
        biz, bookings, payments, users = _stubs_with_one_booking(
            client_first_name=f"{prefix}HYPERLINK(evil)"
        )
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "businesses": biz,
                    "bookings": bookings,
                    "payments": payments,
                    "users": users,
                }
            )
            resp = test_client.get(
                "/analytics/export?format=csv", headers={"Authorization": "Bearer t"}
            )
        rows = _rows_to_csv_dicts(resp.text)
        assert rows[0]["client_name"][0] == "'"
        assert rows[0]["client_name"][1] == prefix

    def test_safe_names_are_untouched(self, test_client, as_owner_a):
        biz, bookings, payments, users = _stubs_with_one_booking(
            client_first_name="Jordan"
        )
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "businesses": biz,
                    "bookings": bookings,
                    "payments": payments,
                    "users": users,
                }
            )
            resp = test_client.get(
                "/analytics/export?format=csv", headers={"Authorization": "Bearer t"}
            )
        rows = _rows_to_csv_dicts(resp.text)
        assert rows[0]["client_name"] == "Jordan"

    def test_comma_and_quote_fields_round_trip_via_csv_module(
        self, test_client, as_owner_a
    ):
        biz, bookings, payments, users = _stubs_with_one_booking(
            client_first_name='Jordan, "The Great"'
        )
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "businesses": biz,
                    "bookings": bookings,
                    "payments": payments,
                    "users": users,
                }
            )
            resp = test_client.get(
                "/analytics/export?format=csv", headers={"Authorization": "Bearer t"}
            )
        rows = _rows_to_csv_dicts(resp.text)
        # csv.DictReader parsing back to the original string proves the writer
        # quoted the comma/quote-bearing field correctly (only one row total).
        assert rows[0]["client_name"] == 'Jordan, "The Great"'
        assert len(rows) == 1


class TestRefundsReduceRevenue:
    def test_refunded_amount_is_excluded_from_total_revenue(
        self, test_client, as_owner_a
    ):
        # total_charged=150, refunded=50, cut=10, released=90 -> 90+10+50=150.
        # A naive export that reported total_charged as "revenue" would say
        # $150. The correct figure is released_to_business: $90.
        biz, bookings, payments, users = _stubs_with_one_booking()
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "businesses": biz,
                    "bookings": bookings,
                    "payments": payments,
                    "users": users,
                }
            )
            resp = test_client.get(
                "/analytics/export?format=json", headers={"Authorization": "Bearer t"}
            )
        body = resp.json()
        assert body["summary"]["total_charged"] == 150.0
        assert body["summary"]["total_refunded"] == 50.0
        assert body["summary"]["total_revenue"] == 90.0
        assert body["summary"]["total_revenue"] < body["summary"]["total_charged"]

    def test_row_level_refunded_field_is_present_and_not_dropped(
        self, test_client, as_owner_a
    ):
        biz, bookings, payments, users = _stubs_with_one_booking()
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "businesses": biz,
                    "bookings": bookings,
                    "payments": payments,
                    "users": users,
                }
            )
            resp = test_client.get(
                "/analytics/export?format=csv", headers={"Authorization": "Bearer t"}
            )
        rows = _rows_to_csv_dicts(resp.text)
        assert rows[0]["refunded"] == "50.00"
        assert rows[0]["released_to_business"] == "90.00"

    def test_two_equal_charges_one_refunded_report_different_revenue(
        self, test_client, as_owner_a
    ):
        """Same total_charged, one row has a refund and the other doesn't —
        the refunded one must report strictly less revenue."""
        biz = SupabaseTableStub(select_data={"id": "biz-a"})
        bookings = SupabaseTableStub(
            select_data=[
                {
                    "id": "bk-1",
                    "created_at": "2026-06-01T00:00:00Z",
                    "service_category": "Cleaning",
                    "client_id": "client-9",
                },
                {
                    "id": "bk-2",
                    "created_at": "2026-06-02T00:00:00Z",
                    "service_category": "Cleaning",
                    "client_id": "client-9",
                },
            ]
        )
        payments = SupabaseTableStub(
            select_data=[
                {
                    "booking_id": "bk-1",
                    "created_at": "2026-06-01T00:00:00Z",
                    "status": "fully_released",
                    "stripe_payment_intent_id": "pi_1",
                    "total_charged_cents": 10000,
                    "released_to_business_cents": 9000,
                    "platform_cut_cents": 1000,
                    "escrow_held_cents": 0,
                    "refunded_cents": 0,
                },
                {
                    "booking_id": "bk-2",
                    "created_at": "2026-06-02T00:00:00Z",
                    "status": "fully_released",
                    "stripe_payment_intent_id": "pi_2",
                    "total_charged_cents": 10000,
                    "released_to_business_cents": 4000,
                    "platform_cut_cents": 1000,
                    "escrow_held_cents": 0,
                    "refunded_cents": 5000,
                },
            ]
        )
        users = SupabaseTableStub(
            select_data=[{"id": "client-9", "first_name": "Jordan", "last_name": ""}]
        )
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "businesses": biz,
                    "bookings": bookings,
                    "payments": payments,
                    "users": users,
                }
            )
            resp = test_client.get(
                "/analytics/export?format=json", headers={"Authorization": "Bearer t"}
            )
        items = {r["booking_id"]: r for r in resp.json()["items"]}
        assert (
            items["bk-1"]["released_to_business"]
            > items["bk-2"]["released_to_business"]
        )
        assert items["bk-2"]["refunded"] == 50.0


class TestEmptyStates:
    def test_no_bookings_returns_valid_csv_with_headers_only(
        self, test_client, as_owner_a
    ):
        biz = SupabaseTableStub(select_data={"id": "biz-a"})
        bookings = SupabaseTableStub(select_data=[])
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {"businesses": biz, "bookings": bookings}
            )
            resp = test_client.get(
                "/analytics/export?format=csv", headers={"Authorization": "Bearer t"}
            )
        assert resp.status_code == 200, resp.text
        assert resp.status_code != 404
        lines = resp.text.strip("\r\n").splitlines()
        assert len(lines) == 1
        header = lines[0].split(",")
        assert "booking_id" in header
        assert "refunded" in header
        assert "released_to_business" in header

    def test_no_bookings_returns_valid_json_with_empty_items(
        self, test_client, as_owner_a
    ):
        biz = SupabaseTableStub(select_data={"id": "biz-a"})
        bookings = SupabaseTableStub(select_data=[])
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {"businesses": biz, "bookings": bookings}
            )
            resp = test_client.get(
                "/analytics/export?format=json", headers={"Authorization": "Bearer t"}
            )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["items"] == []
        assert body["summary"]["total_revenue"] == 0.0
        assert body["summary"]["row_count"] == 0

    def test_date_range_excluding_all_rows_returns_headers_only(
        self, test_client, as_owner_a
    ):
        biz, bookings, payments, users = _stubs_with_one_booking()
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "businesses": biz,
                    "bookings": bookings,
                    "payments": payments,
                    "users": users,
                }
            )
            resp = test_client.get(
                "/analytics/export?format=csv&from=2020-01-01&to=2020-01-31",
                headers={"Authorization": "Bearer t"},
            )
        assert resp.status_code == 200, resp.text
        lines = resp.text.strip("\r\n").splitlines()
        assert len(lines) == 1
        assert "booking_id" in lines[0]


class TestDateValidation:
    def test_from_after_to_is_rejected(self, test_client, as_owner_a):
        biz = SupabaseTableStub(select_data={"id": "biz-a"})
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table({"businesses": biz})
            resp = test_client.get(
                "/analytics/export?format=json&from=2026-06-01&to=2026-01-01",
                headers={"Authorization": "Bearer t"},
            )
        assert resp.status_code == 400

    def test_malformed_date_is_rejected_not_500(self, test_client, as_owner_a):
        biz = SupabaseTableStub(select_data={"id": "biz-a"})
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table({"businesses": biz})
            resp = test_client.get(
                "/analytics/export?format=json&from=not-a-date",
                headers={"Authorization": "Bearer t"},
            )
        assert resp.status_code == 400

    def test_no_dates_supplied_uses_a_default_window(self, test_client, as_owner_a):
        biz = SupabaseTableStub(select_data={"id": "biz-a"})
        bookings = SupabaseTableStub(select_data=[])
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {"businesses": biz, "bookings": bookings}
            )
            resp = test_client.get(
                "/analytics/export?format=json", headers={"Authorization": "Bearer t"}
            )
        assert resp.status_code == 200, resp.text
        rng = resp.json()["range"]
        assert rng["from"] < rng["to"]


class TestUnverifiedEarningsExcluded:
    def test_fully_released_without_capture_is_not_counted_as_revenue(
        self, test_client, as_owner_a
    ):
        """FINDING C parity: a fully_released row with no Stripe intent and no
        off-platform method is phantom money — must not inflate total_revenue,
        matching GET /businesses/me/analytics's unverified_earnings split."""
        biz, bookings, payments, users = _stubs_with_one_booking(
            payment_overrides={
                "stripe_payment_intent_id": None,
                "method": None,
                "refunded_cents": 0,
                "total_charged_cents": 10000,
                "released_to_business_cents": 9000,
                "platform_cut_cents": 1000,
            }
        )
        with patch("app.api.analytics_export.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "businesses": biz,
                    "bookings": bookings,
                    "payments": payments,
                    "users": users,
                }
            )
            resp = test_client.get(
                "/analytics/export?format=json", headers={"Authorization": "Bearer t"}
            )
        summary = resp.json()["summary"]
        assert summary["total_revenue"] == 0.0
        assert summary["unverified_revenue"] == 90.0
