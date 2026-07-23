"""
test_referrals.py — Tests for referral rails (GAP-AUDIT-2026-07-18 #4).

Coverage:
- POST /auth/signup claims a referral_code when it matches a live registry
  row (valid code)
- POST /auth/signup degrades silently on an unknown/invalid referral_code
  (signup still succeeds, no referrals row is written)
- GET /me/referrals generates + persists a new code when the caller has
  none yet
- GET /me/referrals returns the existing code and real counters computed
  from actual claim rows (no fabricated numbers)

Credit APPLICATION is out of scope for beta — these tests only assert
credit_cents is always the real (currently always-zero) sum, never wired
to anything that would change it.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub


class TestSignupReferralCodeClaim:
    """POST /auth/signup with an optional referral_code."""

    def _mock_successful_auth_signup(self, mock_supabase_auth, user_id="new-user-id"):
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_session = MagicMock()
        mock_session.access_token = "test-access-token"
        mock_res = MagicMock()
        mock_res.user = mock_user
        mock_res.session = mock_session
        mock_supabase_auth.auth.sign_up.return_value = mock_res

    def test_valid_referral_code_is_claimed(self, test_client):
        """
        A code that matches a live registry row (referee_id IS NULL) gets
        claimed: a new referrals row is inserted linking referrer -> new
        user, and signup still returns 200.
        """
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth:
            self._mock_successful_auth_signup(mock_supabase_auth, user_id="new-user-id")

            # users upsert
            mock_supabase.table.return_value.upsert.return_value.execute.return_value = (
                None
            )
            # referrals lookup -> a live registry row owned by "referrer-id"
            (
                mock_supabase.table.return_value.select.return_value.eq.return_value.is_.return_value.limit.return_value.execute.return_value.data
            ) = [{"referrer_id": "referrer-id"}]

            response = test_client.post(
                "/auth/signup",
                json={
                    "email": "friend@example.com",
                    "password": "SecurePass123",
                    "first_name": "Jane",
                    "last_name": "Doe",
                    "role": "client",
                    "referral_code": "abc12345",
                },
            )

            assert response.status_code == 200, response.text

            insert_calls = mock_supabase.table.return_value.insert.call_args_list
            assert len(insert_calls) == 1
            payload = insert_calls[0][0][0]
            assert payload["referrer_id"] == "referrer-id"
            assert payload["referee_id"] == "new-user-id"
            assert payload["code"] == "ABC12345"  # normalized uppercase
            assert payload["status"] == "joined"
            assert payload["credit_cents"] == 0

    def test_invalid_referral_code_does_not_block_signup(self, test_client):
        """An unknown code: no registry row found -> signup still succeeds,
        no referrals row is inserted."""
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth:
            self._mock_successful_auth_signup(mock_supabase_auth, user_id="new-user-id")

            mock_supabase.table.return_value.upsert.return_value.execute.return_value = (
                None
            )
            (
                mock_supabase.table.return_value.select.return_value.eq.return_value.is_.return_value.limit.return_value.execute.return_value.data
            ) = []

            response = test_client.post(
                "/auth/signup",
                json={
                    "email": "nobody@example.com",
                    "password": "SecurePass123",
                    "first_name": "No",
                    "last_name": "Body",
                    "role": "client",
                    "referral_code": "NOPE9999",
                },
            )

            assert response.status_code == 200, response.text
            mock_supabase.table.return_value.insert.assert_not_called()

    def test_signup_without_referral_code_unaffected(self, test_client):
        """No referral_code in the body -> no referrals lookup/insert at
        all, signup behaves exactly as before this change."""
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth:
            self._mock_successful_auth_signup(mock_supabase_auth, user_id="new-user-id")
            mock_supabase.table.return_value.upsert.return_value.execute.return_value = (
                None
            )

            response = test_client.post(
                "/auth/signup",
                json={
                    "email": "plain@example.com",
                    "password": "SecurePass123",
                    "first_name": "Plain",
                    "last_name": "Signup",
                    "role": "client",
                },
            )

            assert response.status_code == 200, response.text
            mock_supabase.table.return_value.select.assert_not_called()
            mock_supabase.table.return_value.insert.assert_not_called()


CLIENT = {
    "id": "client-1",
    "role": "client",
    "first_name": "Test",
    "last_name": "Client",
    "email": "client@example.com",
}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


class TestGetMyReferrals:
    """GET /me/referrals — real code + real counters."""

    def test_generates_and_persists_a_new_code_when_none_exists(
        self, test_client, as_client
    ):
        stub = SupabaseTableStub(select_data=[], insert_data=[])
        with patch("app.api.me.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get(
                "/me/referrals", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200, response.text
        body = response.json()
        assert len(body["code"]) == 8
        assert body["code"].isalnum() and body["code"] == body["code"].upper()
        assert body["invited_count"] == 0
        assert body["joined_count"] == 0
        assert body["credit_cents"] == 0

        insert_calls = [c for c in stub.calls if c[0] == "insert"]
        assert len(insert_calls) == 1
        inserted = insert_calls[0][1][0]
        assert inserted["referrer_id"] == "client-1"
        assert inserted["referee_id"] is None
        assert inserted["code"] == body["code"]

    def test_returns_existing_code_and_real_counters(self, test_client, as_client):
        stub = SupabaseTableStub(
            select_data=[
                {"code": "EXIST123", "referee_id": None, "credit_cents": 0},
                {"code": "EXIST123", "referee_id": "friend-1", "credit_cents": 0},
                {"code": "EXIST123", "referee_id": "friend-2", "credit_cents": 0},
            ]
        )
        with patch("app.api.me.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get(
                "/me/referrals", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["code"] == "EXIST123"
        assert body["invited_count"] == 2
        assert body["joined_count"] == 2
        assert body["credit_cents"] == 0

        # Registry row already exists -> no new insert needed.
        insert_calls = [c for c in stub.calls if c[0] == "insert"]
        assert len(insert_calls) == 0

    def test_requires_auth(self, test_client):
        response = test_client.get("/me/referrals")
        assert response.status_code == 401
