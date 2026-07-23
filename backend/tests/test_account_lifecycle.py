"""
test_account_lifecycle.py — account-security & lifecycle guards.

Covers:
  * get_current_user rejects suspended / soft-deleted accounts (403)
  * DELETE /me requires password re-auth and performs a SOFT delete
  * POST /me/ghost blocks on active bookings / escrow / open disputes (409)
  * POST /me/ghost sets is_ghosted; POST /me/unghost clears it
  * express_interest is blocked while the caller is in ghost mode
"""

from unittest.mock import MagicMock, patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub


def _update_payload(stub):
    """Return the dict passed to the stub's most recent .update(...) call."""
    for name, args, _kwargs in reversed(stub.calls):
        if name == "update" and args:
            return args[0]
    return None


# ---------------------------------------------------------------------------
# get_current_user lifecycle enforcement (app.deps)
# ---------------------------------------------------------------------------


def _mock_deps_supabase(mock_supabase, user_row):
    mock_auth_user = MagicMock()
    mock_auth_user.id = user_row["id"]
    mock_auth_res = MagicMock()
    mock_auth_res.user = mock_auth_user
    mock_supabase.auth.get_user.return_value = mock_auth_res
    (
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data
    ) = user_row


class TestSuspensionEnforcement:
    def test_suspended_user_is_rejected_403(self, test_client):
        with patch("app.deps.supabase") as mock_supabase:
            _mock_deps_supabase(
                mock_supabase,
                {
                    "id": "u1",
                    "email": "x@example.com",
                    "role": "client",
                    "is_suspended": True,
                    "deleted_at": None,
                },
            )
            resp = test_client.get("/auth/me", headers={"Authorization": "Bearer tok"})
        assert resp.status_code == 403
        assert resp.json()["detail"] == "account_suspended"

    def test_soft_deleted_user_is_rejected_403(self, test_client):
        with patch("app.deps.supabase") as mock_supabase:
            _mock_deps_supabase(
                mock_supabase,
                {
                    "id": "u1",
                    "email": "x@example.com",
                    "role": "client",
                    "is_suspended": False,
                    "deleted_at": "2026-07-21T00:00:00Z",
                },
            )
            resp = test_client.get("/auth/me", headers={"Authorization": "Bearer tok"})
        assert resp.status_code == 403
        assert resp.json()["detail"] == "account_deactivated"

    def test_healthy_user_passes(self, test_client):
        with patch("app.deps.supabase") as mock_supabase:
            _mock_deps_supabase(
                mock_supabase,
                {
                    "id": "u1",
                    "email": "x@example.com",
                    "role": "client",
                    "is_suspended": False,
                    "deleted_at": None,
                },
            )
            resp = test_client.get("/auth/me", headers={"Authorization": "Bearer tok"})
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# DELETE /me — soft delete + password re-auth
# ---------------------------------------------------------------------------

CLIENT = {
    "id": "client-1",
    "role": "client",
    "email": "client@example.com",
    "first_name": "Test",
    "last_name": "Client",
}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


class TestSoftDelete:
    @pytest.fixture(autouse=True)
    def _reset_limiter(self):
        # DELETE /me is rate-limited 1/hour, keyed by client IP ("testclient"
        # for every test). Reset so each test in this class gets a fresh budget.
        app.state.limiter.reset()
        yield

    def test_wrong_password_returns_401_and_no_write(self, test_client, as_client):
        users_stub = SupabaseTableStub(update_data=[{"id": "client-1"}])
        with patch("app.api.me.supabase") as mock_supabase, patch(
            "app.api.me.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users_stub
            # Failed re-auth: no session.
            mock_auth.auth.sign_in_with_password.return_value = MagicMock(session=None)
            resp = test_client.request(
                "DELETE",
                "/me",
                json={"confirm": "DELETE_MY_ACCOUNT", "password": "wrong"},
            )
        assert resp.status_code == 401
        # Must not have written the soft-delete update.
        assert users_stub.calls == []

    def test_correct_password_soft_deletes_and_scrubs(self, test_client, as_client):
        users_stub = SupabaseTableStub(update_data=[{"id": "client-1"}])
        with patch("app.api.me.supabase") as mock_supabase, patch(
            "app.api.me.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users_stub
            mock_auth.auth.sign_in_with_password.return_value = MagicMock(
                session=MagicMock()
            )
            resp = test_client.request(
                "DELETE",
                "/me",
                json={"confirm": "DELETE_MY_ACCOUNT", "password": "right"},
            )
        assert resp.status_code == 200
        assert resp.json()["message"] == "account_deactivated"
        # The users row was updated with deleted_at + scrubbed PII.
        payload = _update_payload(users_stub)
        assert payload is not None
        assert payload.get("deleted_at")
        assert payload.get("first_name") == "Deleted"
        assert payload.get("phone") is None
        assert payload.get("email", "").endswith("@deleted.swingby.invalid")
        # It must NOT hard-delete via the auth admin API.
        assert not mock_supabase.auth.admin.delete_user.called

    def test_bad_confirm_phrase_rejected(self, test_client, as_client):
        with patch("app.api.me.supabase"), patch("app.api.me.supabase_auth"):
            resp = test_client.request(
                "DELETE",
                "/me",
                json={"confirm": "nope", "password": "right"},
            )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Ghost mode
# ---------------------------------------------------------------------------


class TestGhostMode:
    def _patch_blockers(self, bookings=None, filed_disputes=None, biz_disputes=None):
        """Build a table() side_effect for the ghost-blocker query sequence."""
        # For a client (role != business_owner) the sequence is:
        #   bookings(client) -> disputes(filed) -> [disputes(by booking) if any]
        seq = [SupabaseTableStub(select_data=bookings or [])]
        seq.append(SupabaseTableStub(select_data=filed_disputes or []))
        if bookings:
            seq.append(SupabaseTableStub(select_data=biz_disputes or []))
        # Final update() call when clear to ghost.
        seq.append(SupabaseTableStub(update_data=[{"id": "client-1"}]))
        return seq

    def test_ghost_blocked_by_active_booking_409(self, test_client, as_client):
        with patch("app.api.me.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [
                SupabaseTableStub(
                    select_data=[
                        {"id": "b1", "status": "confirmed", "payment_status": None}
                    ]
                ),
                SupabaseTableStub(select_data=[]),  # filed disputes
                SupabaseTableStub(select_data=[]),  # disputes by booking
            ]
            resp = test_client.post("/me/ghost")
        assert resp.status_code == 409
        detail = resp.json()["detail"]
        assert detail["error"] == "cannot_enter_ghost_mode"
        assert any("active booking" in r for r in detail["reasons"])

    def test_ghost_blocked_by_escrow_409(self, test_client, as_client):
        with patch("app.api.me.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [
                SupabaseTableStub(
                    select_data=[
                        {
                            "id": "b1",
                            "status": "completed",
                            "payment_status": "partial_released",
                        }
                    ]
                ),
                SupabaseTableStub(select_data=[]),
                SupabaseTableStub(select_data=[]),
            ]
            resp = test_client.post("/me/ghost")
        assert resp.status_code == 409
        assert any("escrow" in r for r in resp.json()["detail"]["reasons"])

    def test_ghost_blocked_by_open_dispute_409(self, test_client, as_client):
        with patch("app.api.me.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [
                SupabaseTableStub(select_data=[]),  # bookings(client)
                SupabaseTableStub(
                    select_data=[{"id": "d1", "status": "open"}]
                ),  # filed disputes
            ]
            resp = test_client.post("/me/ghost")
        assert resp.status_code == 409
        assert any("dispute" in r for r in resp.json()["detail"]["reasons"])

    def test_ghost_success_sets_flag(self, test_client, as_client):
        update_stub = SupabaseTableStub(update_data=[{"id": "client-1"}])
        with patch("app.api.me.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [
                SupabaseTableStub(select_data=[]),  # bookings(client)
                SupabaseTableStub(select_data=[]),  # filed disputes
                update_stub,  # users update
            ]
            resp = test_client.post("/me/ghost")
        assert resp.status_code == 200
        assert resp.json()["is_ghosted"] is True
        assert _update_payload(update_stub) == {"is_ghosted": True}

    def test_unghost_clears_flag(self, test_client, as_client):
        update_stub = SupabaseTableStub(update_data=[{"id": "client-1"}])
        with patch("app.api.me.supabase") as mock_supabase:
            mock_supabase.table.return_value = update_stub
            resp = test_client.post("/me/unghost")
        assert resp.status_code == 200
        assert resp.json()["is_ghosted"] is False
        assert _update_payload(update_stub) == {"is_ghosted": False}


class TestGhostBlocksInterest:
    def test_ghosted_owner_cannot_express_interest(self, test_client):
        ghosted_owner = {
            "id": "owner-1",
            "role": "business_owner",
            "email": "o@example.com",
            "is_ghosted": True,
        }
        app.dependency_overrides[get_current_user] = lambda: ghosted_owner
        try:
            resp = test_client.post(
                "/interests/",
                json={"post_id": "p1", "quoted_price": 100},
            )
        finally:
            app.dependency_overrides.pop(get_current_user, None)
        assert resp.status_code == 403
        assert "ghost mode" in resp.json()["detail"]
