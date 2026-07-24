"""
test_auth.py — Tests for /auth endpoints.

Coverage:
- POST /auth/signup with valid/invalid inputs
- POST /auth/login with correct/wrong credentials
- Brute-force lockout (5 failures → 6th attempt returns 429)
- GET /auth/me without/with token
- Response structure validation
"""

import base64 as _b64
import hashlib as _hashlib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

from app.main import app


class TestSignup:
    """Tests for POST /auth/signup."""

    def test_signup_valid_input_returns_200(self, test_client):
        """
        T81.1: Signup with valid input should return 200 + access_token.

        Valid input:
        - email: valid email format
        - password: 8+ chars with uppercase, lowercase, digit
        - first_name, last_name: non-empty
        - role: 'client' or 'business_owner'
        """
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth, patch(
            "app.services.analytics.httpx.post"
        ) as mock_analytics_post:
            # Mock successful auth signup (sign_up lives on the auth-only client)
            mock_user = MagicMock()
            mock_user.id = "test-user-id"
            mock_session = MagicMock()
            mock_session.access_token = "test-access-token"
            mock_res = MagicMock()
            mock_res.user = mock_user
            mock_res.session = mock_session
            mock_supabase_auth.auth.sign_up.return_value = mock_res

            # Mock upsert
            mock_supabase.table.return_value.upsert.return_value.execute.return_value = (
                None
            )
            # CARD-23 GOAL 4: signup fires a best-effort Plausible event — mock
            # the network call out so this test stays hermetic (no real POST
            # to plausible.io during the suite).
            mock_analytics_post.return_value = MagicMock(status_code=202)

            response = test_client.post(
                "/auth/signup",
                json={
                    "email": "test@example.com",
                    "password": "SecurePass123",
                    "first_name": "John",
                    "last_name": "Doe",
                    "role": "client",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert data["user_id"] == "test-user-id"
            # CARD-23 GOAL 4 (K7 — no-analytics): signup fires a "Signup"
            # funnel event to Plausible.
            mock_analytics_post.assert_called_once()
            sent_json = mock_analytics_post.call_args.kwargs["json"]
            assert sent_json["name"] == "Signup"

    def test_signup_succeeds_even_if_analytics_call_raises(self, test_client):
        """
        K7's hard rule: analytics must never block a request path. If
        Plausible is unreachable, signup must still return 200 — the
        exception is swallowed inside track_event(), not propagated.
        """
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth, patch(
            "app.services.analytics.httpx.post",
            side_effect=RuntimeError("Plausible is down"),
        ):
            mock_user = MagicMock()
            mock_user.id = "test-user-id-2"
            mock_session = MagicMock()
            mock_session.access_token = "test-access-token-2"
            mock_res = MagicMock()
            mock_res.user = mock_user
            mock_res.session = mock_session
            mock_supabase_auth.auth.sign_up.return_value = mock_res
            mock_supabase.table.return_value.upsert.return_value.execute.return_value = (
                None
            )

            response = test_client.post(
                "/auth/signup",
                json={
                    "email": "test2@example.com",
                    "password": "SecurePass123",
                    "first_name": "Jane",
                    "last_name": "Doe",
                    "role": "client",
                },
            )

        assert response.status_code == 200
        assert response.json()["user_id"] == "test-user-id-2"

    def test_signup_weak_password_returns_400(self, test_client):
        """
        T81.2: Signup with weak password should return 422/400.
        Password must have: 8+ chars, uppercase, lowercase, digit.
        """
        response = test_client.post(
            "/auth/signup",
            json={
                "email": "test@example.com",
                "password": "weak",  # Too short, no uppercase/digit
                "first_name": "John",
                "last_name": "Doe",
                "role": "client",
            },
        )

        # Pydantic validation error
        assert response.status_code in [400, 422]

    def test_signup_invalid_email_returns_422(self, test_client):
        """
        T81.3: Signup with invalid email should return 422.
        EmailStr validator should reject non-email strings.
        """
        response = test_client.post(
            "/auth/signup",
            json={
                "email": "not-an-email",
                "password": "SecurePass123",
                "first_name": "John",
                "last_name": "Doe",
                "role": "client",
            },
        )

        assert response.status_code == 422


class TestLogin:
    """Tests for POST /auth/login."""

    def test_login_correct_credentials_returns_200(self, test_client):
        """
        T81.4: Login with correct credentials should return 200 + access_token.
        """
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth:
            # Mock successful login (sign_in lives on the auth-only client)
            mock_user = MagicMock()
            mock_user.id = "test-user-id"
            mock_session = MagicMock()
            mock_session.access_token = "test-token"
            mock_res = MagicMock()
            mock_res.user = mock_user
            mock_res.session = mock_session
            mock_supabase_auth.auth.sign_in_with_password.return_value = mock_res

            # Mock user data fetch
            mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
                "id": "test-user-id",
                "role": "client",
                "first_name": "John",
                "last_name": "Doe",
            }

            response = test_client.post(
                "/auth/login",
                json={
                    "email": "test@example.com",
                    "password": "SecurePass123",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert data["user_id"] == "test-user-id"

    def test_login_wrong_password_returns_401(self, test_client):
        """
        T81.5: Login with wrong password should return 401.
        Supabase auth will return no session on invalid credentials.
        """
        with patch("app.api.auth.supabase_auth") as mock_supabase_auth:
            # Mock failed login (no session)
            mock_res = MagicMock()
            mock_res.session = None
            mock_supabase_auth.auth.sign_in_with_password.return_value = mock_res

            response = test_client.post(
                "/auth/login",
                json={
                    "email": "test@example.com",
                    "password": "WrongPassword123",
                },
            )

            assert response.status_code == 401
            assert "Invalid credentials" in response.json().get("detail", "")

    def test_login_5_failures_then_lockout_on_6th(self, test_client):
        """
        T81.6: After 5 failed login attempts (within 15 min window),
        the 6th attempt should return 429 (Too Many Requests).
        """
        # The limiter is keyed by client IP ("testclient" for every test), so
        # earlier login tests consume the 5/minute budget. Reset for determinism.
        app.state.limiter.reset()

        with patch("app.api.auth.supabase_auth") as mock_supabase_auth:
            # Mock failed login
            mock_res = MagicMock()
            mock_res.session = None
            mock_supabase_auth.auth.sign_in_with_password.return_value = mock_res

            # Make 5 failed attempts
            for i in range(5):
                response = test_client.post(
                    "/auth/login",
                    json={
                        "email": "locked@example.com",
                        "password": f"WrongPass{i}",
                    },
                )
                assert response.status_code == 401

            # 6th attempt should be locked out
            response = test_client.post(
                "/auth/login",
                json={
                    "email": "locked@example.com",
                    "password": "AnyPassword",
                },
            )

            assert response.status_code == 429
            # slowapi's default handler responds {"error": "Rate limit exceeded: ..."}
            assert "Rate limit exceeded" in response.json().get("error", "")


class TestGetMe:
    """Tests for GET /auth/me."""

    def test_get_me_without_token_returns_401(self, test_client):
        """
        T81.7: GET /auth/me without Authorization header should return 401.
        """
        response = test_client.get("/auth/me")

        assert response.status_code == 401

    def test_get_me_with_valid_token_returns_200(self, test_client):
        """
        T81.8: GET /auth/me with valid Bearer token should return 200 + user object.
        User object includes: id, email, first_name, last_name, role, avatar_url, created_at.
        """
        # get_current_user lives in app.deps, so that's the supabase to patch —
        # app.api.auth.supabase is never touched by GET /auth/me.
        with patch("app.deps.supabase") as mock_supabase:
            # Mock get_user
            mock_auth_user = MagicMock()
            mock_auth_user.id = "test-user-id"
            mock_auth_res = MagicMock()
            mock_auth_res.user = mock_auth_user
            mock_supabase.auth.get_user.return_value = mock_auth_res

            # Mock database fetch
            mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
                "id": "test-user-id",
                "email": "test@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "role": "client",
                "avatar_url": "https://example.com/avatar.jpg",
                "created_at": "2024-01-01T00:00:00Z",
            }

            response = test_client.get(
                "/auth/me", headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "test-user-id"
            assert data["email"] == "test@example.com"
            assert data["first_name"] == "John"
            assert data["role"] == "client"


class TestSessionRefreshTokenIssued:
    """
    The mobile client refreshes an expired access token instead of logging the
    user out (see the 401 interceptor in mobile/src/services/api.js). That path
    needs a refresh_token to refresh WITH. /auth/refresh always returned one,
    but /auth/login and /auth/signup did not — so the app had nothing stored,
    the refresh could never fire, and every session died at the ~1h access-token
    expiry and dumped the user back at the login screen.

    These tests pin the contract the mobile client depends on. No real token
    value is ever logged or echoed — the mocks use obvious fixtures.
    """

    def test_login_returns_a_non_empty_refresh_token(self, test_client):
        # The limiter is keyed by client IP ("testclient" for every test), so
        # earlier login tests consume the 5/minute budget. Reset for determinism
        # — same reason as test_login_5_failures_then_lockout_on_6th above.
        app.state.limiter.reset()

        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth:
            mock_user = MagicMock()
            mock_user.id = "test-user-id"
            mock_session = MagicMock()
            mock_session.access_token = "fixture-access"
            mock_session.refresh_token = "fixture-refresh"
            mock_session.expires_in = 3600
            mock_res = MagicMock()
            mock_res.user = mock_user
            mock_res.session = mock_session
            mock_supabase_auth.auth.sign_in_with_password.return_value = mock_res

            mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
                "id": "test-user-id",
                "role": "client",
                "first_name": "John",
                "last_name": "Doe",
            }

            response = test_client.post(
                "/auth/login",
                json={
                    "email": "refresh-login@example.com",
                    "password": "SecurePass123",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data.get("refresh_token"), "login must issue a refresh_token"
            assert isinstance(data["refresh_token"], str)
            assert data["refresh_token"] == "fixture-refresh"
            assert data["expires_in"] == 3600
            # The pre-existing contract must not regress.
            assert data["access_token"] == "fixture-access"
            assert data["user_id"] == "test-user-id"

    def test_signup_returns_a_non_empty_refresh_token(self, test_client):
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth, patch(
            "app.services.analytics.httpx.post"
        ) as mock_analytics_post:
            mock_user = MagicMock()
            mock_user.id = "test-user-id"
            mock_session = MagicMock()
            mock_session.access_token = "fixture-access"
            mock_session.refresh_token = "fixture-refresh"
            mock_session.expires_in = 3600
            mock_res = MagicMock()
            mock_res.user = mock_user
            mock_res.session = mock_session
            mock_supabase_auth.auth.sign_up.return_value = mock_res

            mock_supabase.table.return_value.upsert.return_value.execute.return_value = (
                None
            )
            mock_analytics_post.return_value = MagicMock(status_code=202)

            response = test_client.post(
                "/auth/signup",
                json={
                    "email": "refresh-signup@example.com",
                    "password": "SecurePass123",
                    "first_name": "John",
                    "last_name": "Doe",
                    "role": "client",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data.get("refresh_token"), "signup must issue a refresh_token"
            assert data["refresh_token"] == "fixture-refresh"
            assert data["expires_in"] == 3600
            assert data["access_token"] == "fixture-access"

    def test_signup_awaiting_email_confirmation_returns_no_tokens(self, test_client):
        """
        Email confirmation ON — Supabase issues no session. All three token
        fields must come back None rather than raising: the account exists, the
        user just has to confirm. The mobile client branches on a missing
        access_token (services/auth.js) and must not blow up on the others.
        """
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth, patch(
            "app.services.analytics.httpx.post"
        ) as mock_analytics_post:
            mock_user = MagicMock()
            mock_user.id = "test-user-id"
            mock_res = MagicMock()
            mock_res.user = mock_user
            mock_res.session = None  # no session until the email is confirmed
            mock_supabase_auth.auth.sign_up.return_value = mock_res

            mock_supabase.table.return_value.upsert.return_value.execute.return_value = (
                None
            )
            mock_analytics_post.return_value = MagicMock(status_code=202)

            response = test_client.post(
                "/auth/signup",
                json={
                    "email": "confirm-me@example.com",
                    "password": "SecurePass123",
                    "first_name": "John",
                    "last_name": "Doe",
                    "role": "client",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["access_token"] is None
            assert data["refresh_token"] is None
            assert data["expires_in"] is None
            assert "confirm" in data["message"].lower()

    def test_login_survives_a_session_object_with_no_refresh_token(self, test_client):
        """
        Defensive: `res.session` is a Supabase object whose shape we don't
        control. A session without a refresh_token must degrade to None — the
        client then stores nothing and behaves exactly as it did before — rather
        than 500 an otherwise-valid login.
        """
        app.state.limiter.reset()

        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth:
            mock_user = MagicMock()
            mock_user.id = "test-user-id"

            # spec= makes getattr raise AttributeError for anything not listed,
            # which is what a real object missing the field would do.
            mock_session = MagicMock(spec=["access_token"])
            mock_session.access_token = "fixture-access"

            mock_res = MagicMock()
            mock_res.user = mock_user
            mock_res.session = mock_session
            mock_supabase_auth.auth.sign_in_with_password.return_value = mock_res

            mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
                "id": "test-user-id",
                "role": "client",
                "first_name": "John",
                "last_name": "Doe",
            }

            response = test_client.post(
                "/auth/login",
                json={"email": "no-refresh@example.com", "password": "SecurePass123"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["access_token"] == "fixture-access"
            assert data["refresh_token"] is None
            assert data["expires_in"] is None


# ═════════════════════════════════════════════════════════════════════════════
# Social sign-in — /auth/social/*
# ═════════════════════════════════════════════════════════════════════════════
#
# SCOPE OF THESE TESTS: everything on OUR side of the Supabase call. The
# Supabase client is stubbed, so a real Google or Apple round trip is NOT
# exercised here and cannot be — see the NOT VERIFIED section of the AUTH
# report. What IS proven: the PKCE challenge is a correct S256 of the verifier,
# the redirect allowlist closes the open-redirect hole, and — the part that
# actually matters for this codebase — a brand-new social user always ends up
# with a role AND a populated profile row, never a nameless shell.


class _FakeTable:
    """Records writes; replays a fixed row set for reads.

    Deliberately not the shared SupabaseTableStub: these tests need to assert
    on the exact update payloads in order, and to serve different rows for
    `users` vs `businesses` within one request.
    """

    def __init__(self, select_rows=None):
        self.select_rows = select_rows if select_rows is not None else []
        self.upserted = None
        self.updates = []
        self._mode = "select"
        self._pending_update = None

    def select(self, *a, **k):
        self._mode = "select"
        return self

    def eq(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def single(self, *a, **k):
        return self

    def upsert(self, payload, *a, **k):
        self._mode = "upsert"
        self.upserted = payload
        return self

    def update(self, payload, *a, **k):
        self._mode = "update"
        self._pending_update = payload
        return self

    def execute(self):
        if self._mode == "update":
            self.updates.append(self._pending_update)
            self._pending_update = None
            return SimpleNamespace(data=[])
        if self._mode == "upsert":
            return SimpleNamespace(data=[])
        return SimpleNamespace(data=list(self.select_rows))

    # Merged view of everything this table was asked to write.
    @property
    def written(self):
        merged = dict(self.upserted or {})
        for u in self.updates:
            merged.update(u)
        return merged


def _social_session(access="social-access", refresh="social-refresh", expires=3600):
    session = MagicMock()
    session.access_token = access
    session.refresh_token = refresh
    session.expires_in = expires
    return session


def _social_auth_res(
    user_id="social-user-id", email="new.user@gmail.com", metadata=None, session=None
):
    user = MagicMock()
    user.id = user_id
    user.email = email
    user.user_metadata = metadata if metadata is not None else {}
    res = MagicMock()
    res.user = user
    res.session = session if session is not None else _social_session()
    return res


class TestSocialAuthorize:
    """POST /auth/social/authorize — step 1 of the Google PKCE flow."""

    def test_returns_supabase_authorize_url_with_valid_s256_challenge(
        self, test_client
    ):
        app.state.limiter.reset()
        response = test_client.post(
            "/auth/social/authorize",
            json={"provider": "google", "redirect_to": "swingby://auth-callback"},
        )
        assert response.status_code == 200
        data = response.json()

        assert "/auth/v1/authorize?" in data["url"]
        assert "provider=google" in data["url"]
        assert "code_challenge_method=s256" in data["url"]
        assert data["provider"] == "google"

        # The whole point of PKCE: challenge must be BASE64URL(SHA256(verifier)),
        # unpadded. A mismatch here means Supabase would reject the exchange.
        verifier = data["code_verifier"]
        expected = (
            _b64.urlsafe_b64encode(_hashlib.sha256(verifier.encode()).digest())
            .decode()
            .rstrip("=")
        )
        assert f"code_challenge={expected}" in data["url"]

    def test_each_call_mints_a_fresh_verifier(self, test_client):
        app.state.limiter.reset()
        body = {"provider": "google", "redirect_to": "swingby://auth-callback"}
        first = test_client.post("/auth/social/authorize", json=body).json()
        second = test_client.post("/auth/social/authorize", json=body).json()
        assert first["code_verifier"] != second["code_verifier"]

    def test_rejects_redirect_outside_the_allowlist(self, test_client):
        """Open-redirect guard: an attacker-controlled redirect_to would send
        the Supabase auth code to a host we don't own."""
        app.state.limiter.reset()
        response = test_client.post(
            "/auth/social/authorize",
            json={
                "provider": "google",
                "redirect_to": "https://evil.example.com/steal",
            },
        )
        assert response.status_code == 400

    def test_rejects_unknown_provider(self, test_client):
        app.state.limiter.reset()
        response = test_client.post(
            "/auth/social/authorize",
            json={"provider": "facebook", "redirect_to": "swingby://auth-callback"},
        )
        assert response.status_code == 422


class TestSocialExchange:
    """POST /auth/social/exchange — Google code+verifier -> session."""

    def test_new_google_user_gets_role_and_a_populated_profile(self, test_client):
        """THE bug this whole lane exists to prevent.

        handle_new_user() (live trigger on auth.users, verified 2026-07-23)
        inserts a row with role='client' and EMPTY names. Left alone, a Google
        signup produces a nameless profile. The exchange must backfill the
        name from the Google identity and pin the requested role.
        """
        app.state.limiter.reset()
        users = _FakeTable(
            [
                {
                    "id": "social-user-id",
                    "first_name": "",
                    "last_name": "",
                    "email": "new.user@gmail.com",
                    "role": "client",
                    "avatar_url": None,
                    "is_suspended": False,
                    "deleted_at": None,
                }
            ]
        )
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.exchange_code_for_session.return_value = _social_auth_res(
                metadata={
                    "given_name": "Ada",
                    "family_name": "Lovelace",
                    "picture": "https://lh3.googleusercontent.com/ada",
                }
            )

            response = test_client.post(
                "/auth/social/exchange",
                json={
                    "code": "auth-code",
                    "code_verifier": "verifier",
                    "provider": "google",
                    "role": "business_owner",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["access_token"] == "social-access"
        assert data["refresh_token"] == "social-refresh"
        assert data["expires_in"] == 3600
        assert data["is_new_user"] is True
        assert data["provider"] == "google"

        written = users.written
        assert written["first_name"] == "Ada"
        assert written["last_name"] == "Lovelace"
        assert written["role"] == "business_owner"
        assert written["avatar_url"] == "https://lh3.googleusercontent.com/ada"
        assert data["role"] == "business_owner"

    def test_writes_the_whole_row_when_the_trigger_left_nothing(self, test_client):
        """Belt-and-braces: if handle_new_user() never ran (dropped trigger, a
        race), we still must not leave a session pointing at no profile."""
        app.state.limiter.reset()
        users = _FakeTable([])  # no row at all
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.exchange_code_for_session.return_value = _social_auth_res(
                metadata={"full_name": "Grace Hopper"}
            )
            response = test_client.post(
                "/auth/social/exchange",
                json={"code": "c", "code_verifier": "v", "provider": "google"},
            )

        assert response.status_code == 200
        assert users.upserted is not None
        assert users.upserted["id"] == "social-user-id"
        assert users.upserted["first_name"] == "Grace"
        assert users.upserted["last_name"] == "Hopper"
        # role is NOT NULL with no DB default — omitting it would 500 the insert.
        assert users.upserted["role"] == "client"
        assert users.upserted["email"] == "new.user@gmail.com"

    def test_returning_user_keeps_their_existing_role(self, test_client):
        """A social re-login must never demote an established business_owner,
        even if the client cheekily passes role='client'."""
        app.state.limiter.reset()
        users = _FakeTable(
            [
                {
                    "id": "social-user-id",
                    "first_name": "Ada",
                    "last_name": "Lovelace",
                    "email": "new.user@gmail.com",
                    "role": "business_owner",
                    "avatar_url": "https://x/y",
                    "is_suspended": False,
                    "deleted_at": None,
                }
            ]
        )
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.exchange_code_for_session.return_value = _social_auth_res(
                metadata={"given_name": "Ada", "family_name": "Lovelace"}
            )
            response = test_client.post(
                "/auth/social/exchange",
                json={
                    "code": "c",
                    "code_verifier": "v",
                    "provider": "google",
                    "role": "client",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["is_new_user"] is False
        assert data["role"] == "business_owner"
        assert "role" not in users.written

    def test_suspended_account_cannot_sign_in_socially(self, test_client):
        app.state.limiter.reset()
        users = _FakeTable(
            [
                {
                    "id": "social-user-id",
                    "first_name": "Ada",
                    "last_name": "L",
                    "email": "a@b.c",
                    "role": "client",
                    "is_suspended": True,
                    "deleted_at": None,
                }
            ]
        )
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.exchange_code_for_session.return_value = _social_auth_res()
            response = test_client.post(
                "/auth/social/exchange",
                json={"code": "c", "code_verifier": "v", "provider": "google"},
            )

        assert response.status_code == 403
        assert response.json()["detail"] == "account_suspended"
        # Nothing was written for a banned account.
        assert users.written == {}

    def test_soft_deleted_account_cannot_sign_in_socially(self, test_client):
        app.state.limiter.reset()
        users = _FakeTable(
            [
                {
                    "id": "social-user-id",
                    "first_name": "Ada",
                    "last_name": "L",
                    "email": "a@b.c",
                    "role": "client",
                    "is_suspended": False,
                    "deleted_at": "2026-07-01T00:00:00+00:00",
                }
            ]
        )
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.exchange_code_for_session.return_value = _social_auth_res()
            response = test_client.post(
                "/auth/social/exchange",
                json={"code": "c", "code_verifier": "v", "provider": "google"},
            )

        assert response.status_code == 403
        assert response.json()["detail"] == "account_deactivated"

    def test_bad_code_returns_401_not_500(self, test_client):
        app.state.limiter.reset()
        with patch("app.api.auth.supabase"), patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_auth.auth.exchange_code_for_session.side_effect = Exception("bad code")
            response = test_client.post(
                "/auth/social/exchange",
                json={"code": "nope", "code_verifier": "v", "provider": "google"},
            )
        assert response.status_code == 401

    def test_no_session_returned_is_401(self, test_client):
        app.state.limiter.reset()
        res = _social_auth_res()
        res.session = None
        with patch("app.api.auth.supabase"), patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_auth.auth.exchange_code_for_session.return_value = res
            response = test_client.post(
                "/auth/social/exchange",
                json={"code": "c", "code_verifier": "v", "provider": "google"},
            )
        assert response.status_code == 401


class TestSocialIdToken:
    """POST /auth/social/id-token — the Apple-on-iOS door (and native Google).

    NOTE: no real Apple identityToken has ever been through this path. There is
    no Apple Developer account and no iOS build. These tests prove the shape of
    what we send Supabase and what we do with what comes back — not that Apple
    accepts it.
    """

    def test_apple_first_authorization_uses_the_client_supplied_name(self, test_client):
        """Apple sends the user's name ONLY on the very first authorization,
        and only to the native SDK — never in the identity token itself. So the
        client passes it and we use it to fill the NOT NULL name columns."""
        app.state.limiter.reset()
        users = _FakeTable(
            [
                {
                    "id": "social-user-id",
                    "first_name": "",
                    "last_name": "",
                    "email": "relay@privaterelay.appleid.com",
                    "role": "client",
                    "is_suspended": False,
                    "deleted_at": None,
                }
            ]
        )
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.sign_in_with_id_token.return_value = _social_auth_res(
                email="relay@privaterelay.appleid.com", metadata={}
            )
            response = test_client.post(
                "/auth/social/id-token",
                json={
                    "provider": "apple",
                    "id_token": "apple.jwt.here",
                    "nonce": "raw-nonce",
                    "first_name": "Tim",
                    "last_name": "Apple",
                    "role": "client",
                },
            )

        assert response.status_code == 200
        assert response.json()["provider"] == "apple"
        assert users.written["first_name"] == "Tim"
        assert users.written["last_name"] == "Apple"

        sent = mock_auth.auth.sign_in_with_id_token.call_args.args[0]
        assert sent["provider"] == "apple"
        assert sent["token"] == "apple.jwt.here"
        # The nonce must be forwarded or Supabase rejects Apple tokens that
        # were minted with one.
        assert sent["nonce"] == "raw-nonce"

    def test_nonce_is_omitted_when_absent_rather_than_sent_as_null(self, test_client):
        app.state.limiter.reset()
        users = _FakeTable([])
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.sign_in_with_id_token.return_value = _social_auth_res()
            test_client.post(
                "/auth/social/id-token",
                json={"provider": "google", "id_token": "g.jwt"},
            )
        sent = mock_auth.auth.sign_in_with_id_token.call_args.args[0]
        assert "nonce" not in sent

    def test_client_supplied_name_never_overrides_the_provider(self, test_client):
        """A client could lie about its name. Where the provider asserted one,
        the provider wins."""
        app.state.limiter.reset()
        users = _FakeTable([])
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.sign_in_with_id_token.return_value = _social_auth_res(
                metadata={"given_name": "Real", "family_name": "Name"}
            )
            test_client.post(
                "/auth/social/id-token",
                json={
                    "provider": "google",
                    "id_token": "g.jwt",
                    "first_name": "Spoofed",
                    "last_name": "Identity",
                },
            )
        assert users.upserted["first_name"] == "Real"
        assert users.upserted["last_name"] == "Name"

    def test_rejects_provider_outside_the_allowlist(self, test_client):
        app.state.limiter.reset()
        response = test_client.post(
            "/auth/social/id-token",
            json={"provider": "azure", "id_token": "x"},
        )
        assert response.status_code == 422

    def test_rejects_a_role_of_admin(self, test_client):
        """No social door may mint an admin or an employee."""
        app.state.limiter.reset()
        response = test_client.post(
            "/auth/social/id-token",
            json={"provider": "google", "id_token": "x", "role": "admin"},
        )
        assert response.status_code == 422


class TestSocialNameDerivation:
    """users.first_name / last_name are NOT NULL. A provider that tells us
    nothing must still produce a legal row."""

    def test_falls_back_to_the_email_local_part(self, test_client):
        app.state.limiter.reset()
        users = _FakeTable([])
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.sign_in_with_id_token.return_value = _social_auth_res(
                email="anonymous.person@icloud.com", metadata={}
            )
            response = test_client.post(
                "/auth/social/id-token",
                json={"provider": "apple", "id_token": "x"},
            )
        assert response.status_code == 200
        assert users.upserted["first_name"] == "anonymous.person"
        assert users.upserted["last_name"] == ""  # legal: NOT NULL, not non-empty

    def test_single_word_full_name_still_yields_a_first_name(self, test_client):
        app.state.limiter.reset()
        users = _FakeTable([])
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_supabase.table.return_value = users
            mock_auth.auth.sign_in_with_id_token.return_value = _social_auth_res(
                metadata={"name": "Prince"}
            )
            test_client.post(
                "/auth/social/id-token", json={"provider": "google", "id_token": "x"}
            )
        assert users.upserted["first_name"] == "Prince"
        assert users.upserted["last_name"] == ""


class TestSocialRolePick:
    """POST /auth/social/role — one-shot role pick for an account created via
    the LOGIN screen's social button (which carries no role)."""

    @staticmethod
    def _auth_headers():
        return {"Authorization": "Bearer social-jwt"}

    def _run(self, test_client, current_user, businesses_rows=None, body=None):
        from app.deps import get_current_user as real_dep

        app.dependency_overrides[real_dep] = lambda: current_user
        businesses = _FakeTable(businesses_rows or [])
        users = _FakeTable([])

        def _table(name):
            return businesses if name == "businesses" else users

        try:
            with patch("app.api.auth.supabase") as mock_supabase:
                mock_supabase.table.side_effect = _table
                response = test_client.post(
                    "/auth/social/role",
                    json=body or {"role": "business_owner"},
                    headers=self._auth_headers(),
                )
        finally:
            app.dependency_overrides.pop(real_dep, None)
        return response, users

    def test_fresh_client_can_become_a_business_owner(self, test_client):
        app.state.limiter.reset()
        response, users = self._run(
            test_client,
            {
                "id": "social-user-id",
                "role": "client",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        assert response.status_code == 200
        assert response.json()["role"] == "business_owner"
        assert users.updates == [{"role": "business_owner"}]

    def test_established_business_owner_is_refused(self, test_client):
        app.state.limiter.reset()
        response, users = self._run(
            test_client,
            {
                "id": "social-user-id",
                "role": "business_owner",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        assert response.status_code == 403
        assert users.updates == []

    def test_admin_cannot_be_rerolled(self, test_client):
        """The escalation case that actually matters."""
        app.state.limiter.reset()
        response, users = self._run(
            test_client,
            {
                "id": "admin-id",
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        assert response.status_code == 403
        assert users.updates == []

    def test_account_older_than_24h_is_refused(self, test_client):
        app.state.limiter.reset()
        old = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
        response, users = self._run(
            test_client,
            {"id": "social-user-id", "role": "client", "created_at": old},
        )
        assert response.status_code == 403
        assert users.updates == []

    def test_client_who_already_owns_a_business_is_refused(self, test_client):
        app.state.limiter.reset()
        response, users = self._run(
            test_client,
            {
                "id": "social-user-id",
                "role": "client",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            businesses_rows=[{"id": "biz-1"}],
        )
        assert response.status_code == 403
        assert users.updates == []

    def test_rejects_employee_and_admin_as_a_target_role(self, test_client):
        app.state.limiter.reset()
        response, _ = self._run(
            test_client,
            {
                "id": "social-user-id",
                "role": "client",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            body={"role": "admin"},
        )
        assert response.status_code == 422


class TestEmailPasswordFlowNotRegressed:
    """The access_token + refresh_token pair landed on 2026-07-23. Social
    sign-in must not have disturbed it."""

    def test_login_still_returns_both_tokens(self, test_client):
        app.state.limiter.reset()
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_auth:
            mock_user = MagicMock()
            mock_user.id = "test-user-id"
            mock_res = MagicMock()
            mock_res.user = mock_user
            mock_res.session = _social_session("acc", "ref", 3600)
            mock_auth.auth.sign_in_with_password.return_value = mock_res
            mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
                "role": "client",
                "first_name": "John",
                "last_name": "Doe",
            }
            response = test_client.post(
                "/auth/login",
                json={"email": "still@works.com", "password": "SecurePass123"},
            )
        assert response.status_code == 200
        data = response.json()
        assert data["access_token"] == "acc"
        assert data["refresh_token"] == "ref"
        assert data["expires_in"] == 3600
