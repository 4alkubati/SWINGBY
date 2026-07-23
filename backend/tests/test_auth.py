"""
test_auth.py — Tests for /auth endpoints.

Coverage:
- POST /auth/signup with valid/invalid inputs
- POST /auth/login with correct/wrong credentials
- Brute-force lockout (5 failures → 6th attempt returns 429)
- GET /auth/me without/with token
- Response structure validation
"""

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
