"""
test_credits.py — Customer credit ledger (app.services.credits) + /me/credits.

Covers:
- Balance = SUM of the signed ledger.
- grant_credit appends a positive row (and refuses non-positive).
- redeem_credit_for_booking applies min(balance, gross) and records a negative
  row; caps at the charge; no-op when there is no balance.
- GET /me/credits returns balance + history.
"""

from unittest.mock import patch

from app.deps import get_current_user
from app.main import app
from app.services import credits
from tests.conftest import SupabaseTableStub


def _patch_credits(stub):
    p = patch("app.services.credits.supabase")
    m = p.start()
    m.table.side_effect = lambda name: stub
    return p


class TestCreditBalance:
    def test_balance_sums_signed_rows(self):
        stub = SupabaseTableStub(
            select_data=[
                {"amount_cents": 2500},
                {"amount_cents": 1000},
                {"amount_cents": -1500},
            ]
        )
        p = _patch_credits(stub)
        try:
            assert credits.get_balance_cents("user-1") == 2000
        finally:
            p.stop()

    def test_balance_zero_when_no_rows(self):
        stub = SupabaseTableStub(select_data=[])
        p = _patch_credits(stub)
        try:
            assert credits.get_balance_cents("user-1") == 0
        finally:
            p.stop()


class TestGrantCredit:
    def test_grant_appends_positive_row(self):
        stub = SupabaseTableStub(insert_data=[{"id": "uc-1"}])
        p = _patch_credits(stub)
        try:
            row = credits.grant_credit(
                "user-1", credits.GOODWILL_CREDIT_CENTS, "business_cancel_late", "b-1"
            )
        finally:
            p.stop()
        assert row == {"id": "uc-1"}
        assert stub.inserted["user_id"] == "user-1"
        assert stub.inserted["amount_cents"] == credits.GOODWILL_CREDIT_CENTS
        assert stub.inserted["reason"] == "business_cancel_late"
        assert stub.inserted["booking_id"] == "b-1"

    def test_grant_refuses_non_positive(self):
        stub = SupabaseTableStub(insert_data=[{"id": "uc-1"}])
        p = _patch_credits(stub)
        try:
            assert credits.grant_credit("user-1", 0, "noop") is None
            assert credits.grant_credit("user-1", -500, "noop") is None
        finally:
            p.stop()
        # Nothing was inserted.
        assert stub.inserted is None


class TestRedeemCredit:
    def test_redeem_applies_min_balance_and_records_debit(self):
        # balance = $25, charge = $100 → apply $25, net $75, debit -2500.
        stub = SupabaseTableStub(
            select_data=[{"amount_cents": 2500}],
            insert_data=[{"id": "uc-2"}],
        )
        p = _patch_credits(stub)
        try:
            out = credits.redeem_credit_for_booking("user-1", "b-1", 10000)
        finally:
            p.stop()
        assert out["applied_cents"] == 2500
        assert out["net_amount_cents"] == 7500
        assert out["redeemed"] is True
        assert stub.inserted["amount_cents"] == -2500
        assert stub.inserted["booking_id"] == "b-1"
        assert stub.inserted["reason"] == "redemption_at_checkout"

    def test_redeem_caps_at_charge(self):
        # balance = $200, charge = $50 → apply only $50 (never overshoot).
        stub = SupabaseTableStub(
            select_data=[{"amount_cents": 20000}],
            insert_data=[{"id": "uc-3"}],
        )
        p = _patch_credits(stub)
        try:
            out = credits.redeem_credit_for_booking("user-1", "b-1", 5000)
        finally:
            p.stop()
        assert out["applied_cents"] == 5000
        assert out["net_amount_cents"] == 0
        assert stub.inserted["amount_cents"] == -5000

    def test_redeem_noop_when_no_balance(self):
        stub = SupabaseTableStub(select_data=[], insert_data=[{"id": "x"}])
        p = _patch_credits(stub)
        try:
            out = credits.redeem_credit_for_booking("user-1", "b-1", 10000)
        finally:
            p.stop()
        assert out == {"applied_cents": 0, "net_amount_cents": 10000, "redeemed": False}
        assert stub.inserted is None  # no debit written


CLIENT = {"id": "client-1", "role": "client", "first_name": "Jane", "email": "c@x.co"}


class TestMeCreditsEndpoint:
    def test_returns_balance_and_history(self, test_client):
        rows = [
            {
                "id": "uc-1",
                "amount_cents": 2500,
                "reason": "business_cancel_late",
                "booking_id": "b-1",
                "created_at": "2026-07-21T00:00:00Z",
            }
        ]
        stub = SupabaseTableStub(select_data=rows)
        app.dependency_overrides[get_current_user] = lambda: CLIENT
        p = _patch_credits(stub)
        try:
            resp = test_client.get("/me/credits", headers={"Authorization": "Bearer t"})
        finally:
            p.stop()
            app.dependency_overrides.pop(get_current_user, None)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["balance_cents"] == 2500
        assert body["balance"] == 25.00
        assert body["history"] == rows
