"""
test_push_tokens.py — device push-token register/unregister.

The unregister endpoint is the stale-token fix: on logout the token row must be
removed while the request is still authenticated, otherwise the next user on the
same physical device inherits the previous user's push notifications. These
tests assert (a) register upserts on (user_id, token) and (b) unregister deletes
scoped to the caller's own user_id AND the given token — never a broad wipe.
"""

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

USER = {"id": "user-1", "role": "client"}


@pytest.fixture
def as_user():
    app.dependency_overrides[get_current_user] = lambda: USER
    yield USER
    app.dependency_overrides.pop(get_current_user, None)


def test_register_upserts(test_client, as_user):
    stub = SupabaseTableStub(select_data=[{"id": "tok-1"}])
    # upsert switches mode to "upsert"; the stub returns select_data on execute
    # only for the active mode, so seed insert-side data too.
    stub._data["upsert"] = [{"id": "tok-1"}]
    with patch("app.api.push_tokens.supabase") as mock_supabase:
        mock_supabase.table.return_value = stub
        res = test_client.post(
            "/push-tokens/register",
            json={"token": "ExponentPushToken[abc]", "platform": "android"},
        )
    assert res.status_code == 200, res.text
    assert res.json()["token_id"] == "tok-1"
    names = [c[0] for c in stub.calls]
    assert "upsert" in names


def test_unregister_scopes_to_user_and_token(test_client, as_user):
    stub = SupabaseTableStub()
    stub._data["delete"] = []
    with patch("app.api.push_tokens.supabase") as mock_supabase:
        mock_supabase.table.return_value = stub
        res = test_client.post(
            "/push-tokens/unregister",
            json={"token": "ExponentPushToken[abc]"},
        )
    assert res.status_code == 200, res.text
    assert res.json()["message"] == "unregistered"
    # Must filter on BOTH the caller's user_id and the token — never a bare
    # delete that could wipe another user's rows.
    eq_calls = [c[1] for c in stub.calls if c[0] == "eq"]
    assert ("user_id", "user-1") in eq_calls
    assert ("token", "ExponentPushToken[abc]") in eq_calls
    assert any(c[0] == "delete" for c in stub.calls)


def test_unregister_is_idempotent_when_nothing_matches(test_client, as_user):
    stub = SupabaseTableStub()
    stub._data["delete"] = []
    with patch("app.api.push_tokens.supabase") as mock_supabase:
        mock_supabase.table.return_value = stub
        res = test_client.post(
            "/push-tokens/unregister",
            json={"token": "ExponentPushToken[never-registered]"},
        )
    assert res.status_code == 200
