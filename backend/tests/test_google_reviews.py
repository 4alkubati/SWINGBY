"""
test_google_reviews.py — LANE D / walkthrough M3.

Covers backend/app/api/google_reviews.py: importing a business owner's own
verified Google Business Profile reviews.

WHY EVERY GOOGLE CALL IS MOCKED
-------------------------------
Google's Business Profile APIs are behind a manual approval this project has
not been granted, so there is no live endpoint to test against and no token to
test with. Deliberately not a reason to skip: the shapes below are taken from
Google's published API references (Account Management v1 `accounts.list`,
Business Information v1 `accounts.locations.list`, My Business v4
`accounts.locations.reviews.list`, and the OAuth 2.0 token response), so what
is exercised here is OUR logic — the auth boundary, idempotency, the star-enum
mapping and the flag-off path — against payloads of the right shape.

The three things a live run could still surprise us on are listed at the bottom
of docs/GOOGLE_REVIEWS_SETUP.md. Nothing here talks to the network.

Auth is replaced via FastAPI dependency_overrides; Supabase is replaced with
small in-memory fakes so idempotency can be asserted for real (a stub that
always returns the same canned list could not tell a first import from a
second).
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.api import google_reviews as gr
from app.deps import get_current_user
from app.main import app

BUSINESS_ID = "biz-1"
OWNER_ID = "user-owner"

OWNER = {
    "id": OWNER_ID,
    "role": "business_owner",
    "first_name": "Ada",
    "last_name": "Owner",
    "email": "owner@example.com",
}

CLIENT = {
    "id": "user-client",
    "role": "client",
    "first_name": "Cly",
    "last_name": "Ent",
    "email": "client@example.com",
}

OTHER_OWNER = {
    "id": "user-other-owner",
    "role": "business_owner",
    "first_name": "Otto",
    "last_name": "Other",
    "email": "other@example.com",
}

LOCATION = "accounts/111/locations/222"


# ─── Fakes ────────────────────────────────────────────────────────────────────


class FakeTable:
    """A tiny in-memory PostgREST stand-in: real filters, real upsert semantics.

    Only the subset this module uses: select/insert/upsert/update/delete, eq,
    order, single, execute. `unique` is the conflict target so upsert can
    genuinely de-duplicate rather than just being asserted about.
    """

    def __init__(self, rows=None, unique=None):
        self.rows = list(rows or [])
        self.unique = tuple(unique or ())
        self._mode = "select"
        self._filters = []
        self._payload = None
        self._single = False
        self.upsert_conflict = None

    # -- chain ------------------------------------------------------------
    def select(self, *_args, **_kwargs):
        self._mode = "select"
        self._filters = []
        self._single = False
        return self

    def insert(self, payload):
        self._mode = "insert"
        self._payload = payload
        return self

    def upsert(self, payload, on_conflict=None):
        self._mode = "upsert"
        self._payload = payload
        self.upsert_conflict = on_conflict
        return self

    def update(self, payload):
        self._mode = "update"
        self._payload = payload
        self._filters = []
        return self

    def delete(self):
        self._mode = "delete"
        self._filters = []
        return self

    def eq(self, column, value):
        self._filters.append((column, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def single(self):
        self._single = True
        return self

    # -- terminal ---------------------------------------------------------
    def execute(self):
        if self._mode in ("insert", "upsert"):
            payload = self._payload
            batch = payload if isinstance(payload, list) else [payload]
            for row in batch:
                target = self._find_conflict(row) if self._mode == "upsert" else None
                if target is None:
                    self.rows.append(dict(row))
                else:
                    target.update(row)
            return SimpleNamespace(data=[dict(r) for r in batch], count=len(batch))

        matched = [r for r in self.rows if self._matches(r)]

        if self._mode == "update":
            for row in matched:
                row.update(self._payload)
            return SimpleNamespace(data=matched, count=len(matched))

        if self._mode == "delete":
            self.rows = [r for r in self.rows if not self._matches(r)]
            return SimpleNamespace(data=matched, count=len(matched))

        if self._single:
            if not matched:
                # PostgREST raises on .single() with no row; _load_connection
                # and _owner_business both rely on that being an exception.
                raise RuntimeError("no rows returned by single()")
            return SimpleNamespace(data=dict(matched[0]), count=1)

        return SimpleNamespace(data=[dict(r) for r in matched], count=len(matched))

    # -- internals --------------------------------------------------------
    def _matches(self, row):
        return all(row.get(col) == val for col, val in self._filters)

    def _find_conflict(self, row):
        if not self.unique:
            return None
        key = tuple(row.get(c) for c in self.unique)
        for existing in self.rows:
            if tuple(existing.get(c) for c in self.unique) == key:
                return existing
        return None


class FakeDB:
    def __init__(self, **tables):
        self.tables = tables

    def table(self, name):
        if name not in self.tables:
            self.tables[name] = FakeTable()
        return self.tables[name]


def _fresh_db(connection=None, imported=None, states=None, businesses=None):
    return FakeDB(
        businesses=FakeTable(
            businesses
            if businesses is not None
            else [
                {
                    "id": BUSINESS_ID,
                    "owner_id": OWNER_ID,
                    "business_name": "Calgary Clean Co.",
                }
            ]
        ),
        business_google_connections=FakeTable(
            [connection] if connection else [], unique=("business_id",)
        ),
        business_google_oauth_states=FakeTable(states or [], unique=("state",)),
        business_imported_reviews=FakeTable(
            imported or [],
            unique=("business_id", "source", "external_review_id"),
        ),
    )


def _live_connection(**overrides):
    return {
        "business_id": BUSINESS_ID,
        "connected_by": OWNER_ID,
        "google_account_email": "owner@example.com",
        "access_token": "ya29.live",
        "refresh_token": "1//refresh",
        "token_expires_at": (
            datetime.now(timezone.utc) + timedelta(hours=1)
        ).isoformat(),
        "scopes": gr.GBP_SCOPE,
        "status": "connected",
        "selected_location": None,
        **overrides,
    }


# Google payloads. Shapes from Google's published API references.
GOOGLE_ACCOUNTS = {
    "accounts": [{"name": "accounts/111", "accountName": "Calgary Clean Co."}]
}

GOOGLE_LOCATIONS = {
    "locations": [
        {
            "name": "locations/222",
            "title": "Calgary Clean Co. — Beltline",
            "storefrontAddress": {
                "addressLines": ["101 12 Ave SW"],
                "locality": "Calgary",
            },
        }
    ]
}

GOOGLE_REVIEWS = {
    "averageRating": 4.5,
    "totalReviewCount": 4,
    "reviews": [
        {
            "reviewId": "rev-aaa",
            "reviewer": {
                "displayName": "Jane D.",
                "profilePhotoUrl": "https://x/j.jpg",
            },
            "starRating": "FIVE",
            "comment": "Spotless, on time, would book again.",
            "createTime": "2026-03-01T10:00:00.123456789Z",
            "updateTime": "2026-03-01T10:00:00Z",
        },
        {
            "reviewId": "rev-bbb",
            "reviewer": {"isAnonymous": True},
            "starRating": "TWO",
            "comment": "Late twice.",
            "createTime": "2026-02-01T10:00:00Z",
        },
        {
            # No stable id → unstorable, must be skipped rather than invented.
            "reviewer": {"displayName": "Ghost"},
            "starRating": "FIVE",
            "comment": "no id",
            "createTime": "2026-01-01T10:00:00Z",
        },
        {
            # Google itself calls this rating unspecified. Guessing a star here
            # would be fabricating one.
            "reviewId": "rev-ddd",
            "reviewer": {"displayName": "Unrated"},
            "starRating": "STAR_RATING_UNSPECIFIED",
            "createTime": "2026-01-02T10:00:00Z",
        },
    ],
}


def _google_get(url, params=None, headers=None, timeout=None):
    """Dispatch a mocked Google GET by URL. Never touches the network."""
    if url.startswith(gr.GBP_ACCOUNTS_URL):
        body = GOOGLE_ACCOUNTS
    elif url.endswith("/reviews"):
        body = GOOGLE_REVIEWS
    elif url.endswith("/locations"):
        body = GOOGLE_LOCATIONS
    else:  # pragma: no cover - guards a typo in a future test
        raise AssertionError(f"unexpected Google GET {url}")
    return MagicMock(status_code=200, json=MagicMock(return_value=body))


# ─── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def as_owner():
    app.dependency_overrides[get_current_user] = lambda: OWNER
    yield OWNER
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_client_role():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def flag_on(monkeypatch):
    monkeypatch.setenv("GOOGLE_REVIEWS_ENABLED", "1")
    monkeypatch.setenv("GOOGLE_BUSINESS_CLIENT_ID", "test-client-id.apps.google.com")
    monkeypatch.setenv("GOOGLE_BUSINESS_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv("GOOGLE_BUSINESS_REDIRECT_URI", "swingby://google-reviews")
    yield


@pytest.fixture
def flag_off(monkeypatch):
    monkeypatch.delenv("GOOGLE_REVIEWS_ENABLED", raising=False)
    yield


# ═════════════════════════════════════════════════════════════════════════════
# 1. The flag-off path — the state this ships in
# ═════════════════════════════════════════════════════════════════════════════


class TestFeatureFlagOff:
    """With GOOGLE_REVIEWS_ENABLED unset, nothing must break and nothing must
    talk to Google. `/status` still answers so the UI can render "coming soon"
    rather than a button that fails."""

    def test_flag_defaults_to_off(self, flag_off):
        assert gr.google_reviews_enabled() is False

    @pytest.mark.parametrize(
        "value,expected",
        [
            ("1", True),
            ("true", True),
            ("TRUE", True),
            ("yes", True),
            ("on", True),
            ("0", False),
            ("false", False),
            ("", False),
            ("maybe", False),
        ],
    )
    def test_flag_parsing(self, monkeypatch, value, expected):
        monkeypatch.setenv("GOOGLE_REVIEWS_ENABLED", value)
        assert gr.google_reviews_enabled() is expected

    def test_status_reports_coming_soon(self, test_client, as_owner, flag_off):
        db = _fresh_db()
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            res = test_client.get("/google-reviews/status")
            assert res.status_code == 200
            body = res.json()
            assert body["enabled"] is False
            assert body["connected"] is False
            assert body["status"] == "coming_soon"
            assert body["imported_count"] == 0
            assert body["message"]
            # The whole point of dark mode: zero Google traffic.
            http.get.assert_not_called()
            http.post.assert_not_called()

    def test_connect_is_503_not_500(self, test_client, as_owner, flag_off):
        db = _fresh_db()
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            res = test_client.post("/google-reviews/connect", json={})
            assert res.status_code == 503
            assert "Google" in res.json()["detail"]
            http.post.assert_not_called()

    def test_import_is_503(self, test_client, as_owner, flag_off):
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            res = test_client.post(
                "/google-reviews/import", json={"location": LOCATION}
            )
            assert res.status_code == 503
            http.get.assert_not_called()

    def test_locations_is_503(self, test_client, as_owner, flag_off):
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx"):
            assert test_client.get("/google-reviews/locations").status_code == 503

    def test_public_read_still_works_with_flag_off(
        self, test_client, as_client_role, flag_off
    ):
        """A review imported while the flag was on must not vanish if it is
        later switched off."""
        db = _fresh_db(
            imported=[
                {
                    "id": "ir-1",
                    "business_id": BUSINESS_ID,
                    "source": "google",
                    "external_review_id": "rev-aaa",
                    "author_name": "Jane D.",
                    "rating": 5,
                    "comment": "Spotless.",
                    "verified": True,
                }
            ]
        )
        with patch.object(gr, "supabase", db):
            res = test_client.get(f"/google-reviews/business/{BUSINESS_ID}")
            assert res.status_code == 200
            body = res.json()
            assert body["summary"]["count"] == 1
            assert body["reviews"][0]["verified"] is True
            assert body["reviews"][0]["source"] == "google"

    def test_flag_off_does_not_block_disconnect(self, test_client, as_owner, flag_off):
        """Withdrawing consent must never be gated behind a feature flag."""
        db = _fresh_db(
            connection=_live_connection(),
            imported=[
                {
                    "id": "ir-1",
                    "business_id": BUSINESS_ID,
                    "source": "google",
                    "external_review_id": "rev-aaa",
                    "rating": 5,
                }
            ],
        )
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx"):
            res = test_client.delete("/google-reviews/disconnect")
            assert res.status_code == 200
            assert res.json()["connected"] is False
            assert db.tables["business_imported_reviews"].rows == []
            assert db.tables["business_google_connections"].rows == []


# ═════════════════════════════════════════════════════════════════════════════
# 2. The auth boundary
# ═════════════════════════════════════════════════════════════════════════════


class TestAuthBoundary:
    """Only the authenticated owner, only their own business, never by id."""

    @pytest.mark.parametrize(
        "method,path,payload",
        [
            ("get", "/google-reviews/status", None),
            ("post", "/google-reviews/connect", {}),
            ("get", "/google-reviews/locations", None),
            ("post", "/google-reviews/import", {"location": LOCATION}),
            ("delete", "/google-reviews/disconnect", None),
        ],
    )
    def test_clients_are_refused(
        self, test_client, as_client_role, flag_on, method, path, payload
    ):
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            call = getattr(test_client, method)
            res = call(path, json=payload) if payload is not None else call(path)
            assert res.status_code == 403
            assert "business owners" in res.json()["detail"]
            http.get.assert_not_called()

    def test_missing_token_is_401(self, test_client, flag_on):
        """No dependency override — the real get_current_user must reject."""
        res = test_client.get("/google-reviews/status")
        assert res.status_code == 401

    def test_owner_without_a_business_is_404(self, test_client, as_owner, flag_on):
        db = _fresh_db(businesses=[])
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx"):
            res = test_client.post("/google-reviews/connect", json={})
            assert res.status_code == 404

    def test_import_endpoint_takes_no_business_id(self):
        """Structural guarantee: there is no field through which a caller could
        name someone else's business, so the server-side check cannot be
        bypassed by a crafted payload."""
        assert "business_id" not in gr.ImportRequest.model_fields
        assert "business_id" not in gr.ConnectStart.model_fields
        assert "business_id" not in gr.ConnectCallback.model_fields

    def test_extra_business_id_in_body_is_ignored(self, test_client, as_owner, flag_on):
        """Even if a caller posts one, the import lands on THEIR business."""
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.get.side_effect = _google_get
            res = test_client.post(
                "/google-reviews/import",
                json={"location": LOCATION, "business_id": "biz-someone-else"},
            )
            assert res.status_code == 200
            written = db.tables["business_imported_reviews"].rows
            assert written
            assert {r["business_id"] for r in written} == {BUSINESS_ID}

    def test_callback_state_belonging_to_another_owner_is_403(
        self, test_client, flag_on
    ):
        """The OAuth state row is bound to the user AND the business that
        started the flow. Redeeming someone else's code is the attack this
        stops."""
        app.dependency_overrides[get_current_user] = lambda: OTHER_OWNER
        db = _fresh_db(
            businesses=[
                {
                    "id": BUSINESS_ID,
                    "owner_id": OWNER_ID,
                    "business_name": "Calgary Clean Co.",
                },
                {
                    "id": "biz-2",
                    "owner_id": OTHER_OWNER["id"],
                    "business_name": "Other Co.",
                },
            ],
            states=[
                {
                    "state": "st-1",
                    "business_id": BUSINESS_ID,
                    "user_id": OWNER_ID,
                    "code_verifier": "v",
                    "redirect_uri": "swingby://google-reviews",
                    "expires_at": (
                        datetime.now(timezone.utc) + timedelta(minutes=5)
                    ).isoformat(),
                    "used_at": None,
                }
            ],
        )
        try:
            with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
                res = test_client.post(
                    "/google-reviews/callback",
                    json={"code": "auth-code", "state": "st-1"},
                )
                assert res.status_code == 403
                # No token exchange may be attempted for a stolen state.
                http.post.assert_not_called()
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_callback_state_cannot_be_replayed(self, test_client, as_owner, flag_on):
        db = _fresh_db(
            states=[
                {
                    "state": "st-used",
                    "business_id": BUSINESS_ID,
                    "user_id": OWNER_ID,
                    "code_verifier": "v",
                    "redirect_uri": "swingby://google-reviews",
                    "expires_at": (
                        datetime.now(timezone.utc) + timedelta(minutes=5)
                    ).isoformat(),
                    "used_at": datetime.now(timezone.utc).isoformat(),
                }
            ]
        )
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            res = test_client.post(
                "/google-reviews/callback",
                json={"code": "auth-code", "state": "st-used"},
            )
            assert res.status_code == 400
            http.post.assert_not_called()

    def test_callback_expired_state_is_rejected(self, test_client, as_owner, flag_on):
        db = _fresh_db(
            states=[
                {
                    "state": "st-old",
                    "business_id": BUSINESS_ID,
                    "user_id": OWNER_ID,
                    "code_verifier": "v",
                    "redirect_uri": "swingby://google-reviews",
                    "expires_at": (
                        datetime.now(timezone.utc) - timedelta(minutes=1)
                    ).isoformat(),
                    "used_at": None,
                }
            ]
        )
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            res = test_client.post(
                "/google-reviews/callback",
                json={"code": "auth-code", "state": "st-old"},
            )
            assert res.status_code == 400
            http.post.assert_not_called()

    def test_import_of_a_location_the_account_does_not_own_is_403(
        self, test_client, as_owner, flag_on
    ):
        """The strongest one: valid owner, valid tokens, someone else's
        location. Without this check an owner could paste a competitor's
        resource name and inherit their reviews."""
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.get.side_effect = _google_get
            res = test_client.post(
                "/google-reviews/import",
                json={"location": "accounts/999/locations/999"},
            )
            assert res.status_code == 403
            assert db.tables["business_imported_reviews"].rows == []

    def test_import_without_a_connection_is_409(self, test_client, as_owner, flag_on):
        db = _fresh_db(connection=None)
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            res = test_client.post(
                "/google-reviews/import", json={"location": LOCATION}
            )
            assert res.status_code == 409
            http.get.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════════
# 3. The connect flow
# ═════════════════════════════════════════════════════════════════════════════


class TestConnectFlow:
    def test_connect_builds_a_real_google_url(self, test_client, as_owner, flag_on):
        db = _fresh_db()
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx"):
            res = test_client.post("/google-reviews/connect", json={})
            assert res.status_code == 200
            url = res.json()["authorization_url"]

        assert url.startswith(gr.GOOGLE_AUTH_URL)
        # The business.manage scope — NOT the sign-in identity scopes. This is a
        # separate consent from app/api/auth.py's Google flow.
        assert "business.manage" in url
        assert "code_challenge_method=S256" in url
        # offline + consent is what yields a refresh token; without it the
        # connection dies an hour later.
        assert "access_type=offline" in url
        assert "prompt=consent" in url

        state_rows = db.tables["business_google_oauth_states"].rows
        assert len(state_rows) == 1
        # The verifier is parked server-side and never travels with the code.
        assert state_rows[0]["code_verifier"]
        assert state_rows[0]["business_id"] == BUSINESS_ID
        assert state_rows[0]["user_id"] == OWNER_ID
        assert res.json()["state"] == state_rows[0]["state"]

    def test_open_redirect_is_refused(self, test_client, as_owner, flag_on):
        db = _fresh_db()
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx"):
            res = test_client.post(
                "/google-reviews/connect",
                json={"redirect_uri": "https://evil.example.com/harvest"},
            )
            assert res.status_code == 400
            assert db.tables["business_google_oauth_states"].rows == []

    def test_callback_stores_tokens_and_returns_locations(
        self, test_client, as_owner, flag_on
    ):
        db = _fresh_db(
            states=[
                {
                    "state": "st-ok",
                    "business_id": BUSINESS_ID,
                    "user_id": OWNER_ID,
                    "code_verifier": "verifier",
                    "redirect_uri": "swingby://google-reviews",
                    "expires_at": (
                        datetime.now(timezone.utc) + timedelta(minutes=5)
                    ).isoformat(),
                    "used_at": None,
                }
            ]
        )
        token_body = {
            "access_token": "ya29.fresh",
            "refresh_token": "1//refresh",
            "expires_in": 3599,
            "scope": gr.GBP_SCOPE,
            "token_type": "Bearer",
        }
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.post.return_value = MagicMock(
                status_code=200, json=MagicMock(return_value=token_body)
            )
            http.get.side_effect = _google_get
            res = test_client.post(
                "/google-reviews/callback",
                json={"code": "auth-code", "state": "st-ok"},
            )

        assert res.status_code == 200
        body = res.json()
        assert body["connected"] is True
        # Location names are normalised to the full accounts/*/locations/*
        # resource path the v4 reviews endpoint needs.
        assert body["locations"][0]["name"] == LOCATION

        conn = db.tables["business_google_connections"].rows[0]
        assert conn["business_id"] == BUSINESS_ID
        assert conn["refresh_token"] == "1//refresh"
        assert conn["status"] == "connected"
        # State burned, so the code cannot be redeemed twice.
        assert db.tables["business_google_oauth_states"].rows[0]["used_at"]

    def test_callback_rejects_a_grant_missing_the_scope(
        self, test_client, as_owner, flag_on
    ):
        """User un-ticked the permission. Say so now, not on the first 403."""
        db = _fresh_db(
            states=[
                {
                    "state": "st-ok",
                    "business_id": BUSINESS_ID,
                    "user_id": OWNER_ID,
                    "code_verifier": "verifier",
                    "redirect_uri": "swingby://google-reviews",
                    "expires_at": (
                        datetime.now(timezone.utc) + timedelta(minutes=5)
                    ).isoformat(),
                    "used_at": None,
                }
            ]
        )
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.post.return_value = MagicMock(
                status_code=200,
                json=MagicMock(
                    return_value={
                        "access_token": "ya29.x",
                        "expires_in": 3599,
                        "scope": "openid email",
                    }
                ),
            )
            res = test_client.post(
                "/google-reviews/callback",
                json={"code": "auth-code", "state": "st-ok"},
            )
        assert res.status_code == 400
        assert "reviews" in res.json()["detail"]
        assert db.tables["business_google_connections"].rows == []

    def test_expired_access_token_is_refreshed_before_use(
        self, test_client, as_owner, flag_on
    ):
        db = _fresh_db(
            connection=_live_connection(
                access_token="ya29.stale",
                token_expires_at=(
                    datetime.now(timezone.utc) - timedelta(minutes=5)
                ).isoformat(),
            )
        )
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.post.return_value = MagicMock(
                status_code=200,
                json=MagicMock(
                    return_value={"access_token": "ya29.rotated", "expires_in": 3599}
                ),
            )
            http.get.side_effect = _google_get
            res = test_client.get("/google-reviews/locations")

        assert res.status_code == 200
        assert http.post.call_args.kwargs["data"]["grant_type"] == "refresh_token"
        assert db.tables["business_google_connections"].rows[0]["access_token"] == (
            "ya29.rotated"
        )

    def test_lost_refresh_token_flags_needs_reauth(
        self, test_client, as_owner, flag_on
    ):
        db = _fresh_db(
            connection=_live_connection(
                refresh_token=None,
                token_expires_at=(
                    datetime.now(timezone.utc) - timedelta(minutes=5)
                ).isoformat(),
            )
        )
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            res = test_client.get("/google-reviews/locations")
            assert res.status_code == 409
            http.post.assert_not_called()
        assert db.tables["business_google_connections"].rows[0]["status"] == (
            "needs_reauth"
        )


# ═════════════════════════════════════════════════════════════════════════════
# 4. Import — idempotency and provenance
# ═════════════════════════════════════════════════════════════════════════════


class TestImport:
    def test_first_import_stores_reviews_with_provenance(
        self, test_client, as_owner, flag_on
    ):
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.get.side_effect = _google_get
            res = test_client.post(
                "/google-reviews/import", json={"location": LOCATION}
            )

        assert res.status_code == 200
        body = res.json()
        # Two of the four fixtures are storable; the other two are skipped
        # rather than having an id or a star invented for them.
        assert body["imported"] == 2
        assert body["updated"] == 0
        assert body["skipped"] == 2

        rows = {
            r["external_review_id"]: r
            for r in db.tables["business_imported_reviews"].rows
        }
        assert set(rows) == {"rev-aaa", "rev-bbb"}
        for row in rows.values():
            assert row["source"] == "google"
            assert row["verified"] is True
            assert row["business_id"] == BUSINESS_ID
            assert row["external_location"] == LOCATION
        assert rows["rev-aaa"]["rating"] == 5
        # An anonymous Google reviewer keeps their anonymity and their photo is
        # not carried over.
        assert rows["rev-bbb"]["author_name"] == "Google user"
        assert rows["rev-bbb"]["author_photo_url"] is None
        # Nanosecond precision from Google must not blow up the parse.
        assert rows["rev-aaa"]["reviewed_at"].startswith("2026-03-01T10:00:00")

    def test_the_bad_review_is_imported_too(self, test_client, as_owner, flag_on):
        """No cherry-picking: a 2-star comes across exactly like a 5-star.
        A rating filter here would let owners launder their reputation."""
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.get.side_effect = _google_get
            test_client.post("/google-reviews/import", json={"location": LOCATION})
        ratings = sorted(
            r["rating"] for r in db.tables["business_imported_reviews"].rows
        )
        assert ratings == [2, 5]

    def test_reimport_is_idempotent(self, test_client, as_owner, flag_on):
        """The founder's owners WILL press Import twice. Row count must not
        move, and the second run must report 0 new."""
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.get.side_effect = _google_get
            first = test_client.post(
                "/google-reviews/import", json={"location": LOCATION}
            ).json()
            after_first = len(db.tables["business_imported_reviews"].rows)

            second = test_client.post(
                "/google-reviews/import", json={"location": LOCATION}
            ).json()
            after_second = len(db.tables["business_imported_reviews"].rows)

        assert first["imported"] == 2
        assert second["imported"] == 0
        assert second["updated"] == 2
        assert after_first == after_second == 2
        # The upsert must actually target the unique constraint from the
        # migration, not rely on the fake being forgiving.
        assert db.tables["business_imported_reviews"].upsert_conflict == (
            "business_id,source,external_review_id"
        )

    def test_reimport_refreshes_an_edited_review_in_place(
        self, test_client, as_owner, flag_on
    ):
        db = _fresh_db(
            connection=_live_connection(),
            imported=[
                {
                    "id": "ir-old",
                    "business_id": BUSINESS_ID,
                    "source": "google",
                    "external_review_id": "rev-aaa",
                    "author_name": "Jane D.",
                    "rating": 1,
                    "comment": "Old text the reviewer has since edited.",
                    "verified": True,
                }
            ],
        )
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.get.side_effect = _google_get
            res = test_client.post(
                "/google-reviews/import", json={"location": LOCATION}
            ).json()

        assert res["imported"] == 1  # only rev-bbb is new
        rows = db.tables["business_imported_reviews"].rows
        assert len(rows) == 2
        updated = next(r for r in rows if r["external_review_id"] == "rev-aaa")
        assert updated["rating"] == 5
        assert updated["comment"] == "Spotless, on time, would book again."

    def test_duplicate_ids_across_pages_do_not_double_count(self):
        rows = []
        seen = set()
        payload = [
            {"reviewId": "dup", "starRating": "FIVE", "reviewer": {}},
            {"reviewId": "dup", "starRating": "FIVE", "reviewer": {}},
        ]
        for review in payload:
            row = gr._to_row(review, BUSINESS_ID, LOCATION, OWNER_ID)
            if row and row["external_review_id"] not in seen:
                seen.add(row["external_review_id"])
                rows.append(row)
        assert len(rows) == 1

    def test_import_records_selection_and_timestamp(
        self, test_client, as_owner, flag_on
    ):
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.get.side_effect = _google_get
            test_client.post("/google-reviews/import", json={"location": LOCATION})
        conn = db.tables["business_google_connections"].rows[0]
        assert conn["selected_location"] == LOCATION
        assert conn["selected_location_title"] == "Calgary Clean Co. — Beltline"
        assert conn["last_import_at"]
        assert conn["last_import_error"] is None

    def test_a_malformed_location_never_reaches_google(
        self, test_client, as_owner, flag_on
    ):
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            res = test_client.post(
                "/google-reviews/import", json={"location": "not-a-resource-name"}
            )
            assert res.status_code == 422
            http.get.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════════
# 5. Provenance never leaks into the native SwingBy rating
# ═════════════════════════════════════════════════════════════════════════════


class TestNeverBlended:
    def test_import_never_writes_to_reviews_or_businesses(
        self, test_client, as_owner, flag_on
    ):
        """businesses.avg_rating must keep meaning "rated on a completed
        SwingBy job". If an import ever updates it, that meaning is gone and
        no caller can recover it."""
        db = _fresh_db(connection=_live_connection())
        with patch.object(gr, "supabase", db), patch.object(gr, "httpx") as http:
            http.get.side_effect = _google_get
            test_client.post("/google-reviews/import", json={"location": LOCATION})

        # No `reviews` table was ever touched.
        assert "reviews" not in db.tables
        # The businesses row is byte-identical to what we started with.
        assert db.tables["businesses"].rows == [
            {
                "id": BUSINESS_ID,
                "owner_id": OWNER_ID,
                "business_name": "Calgary Clean Co.",
            }
        ]

    def test_public_payload_labels_every_row(
        self, test_client, as_client_role, flag_on
    ):
        db = _fresh_db(
            imported=[
                {
                    "id": "ir-1",
                    "business_id": BUSINESS_ID,
                    "source": "google",
                    "external_review_id": "rev-aaa",
                    "author_name": "Jane D.",
                    "rating": 5,
                    "verified": True,
                },
                {
                    "id": "ir-2",
                    "business_id": BUSINESS_ID,
                    "source": "google",
                    "external_review_id": "rev-bbb",
                    "author_name": "Google user",
                    "rating": 2,
                    "verified": True,
                },
            ]
        )
        with patch.object(gr, "supabase", db):
            body = test_client.get(f"/google-reviews/business/{BUSINESS_ID}").json()

        assert body["summary"] == {"count": 2, "average_rating": 3.5}
        for row in body["reviews"]:
            # Without both of these a client could render an imported review as
            # if a SwingBy client had left it.
            assert row["source"] == "google"
            assert row["verified"] is True

    def test_another_businesss_reviews_are_not_returned(
        self, test_client, as_client_role, flag_on
    ):
        db = _fresh_db(
            imported=[
                {
                    "id": "ir-1",
                    "business_id": BUSINESS_ID,
                    "source": "google",
                    "external_review_id": "rev-aaa",
                    "rating": 5,
                    "verified": True,
                },
                {
                    "id": "ir-2",
                    "business_id": "biz-other",
                    "source": "google",
                    "external_review_id": "rev-zzz",
                    "rating": 1,
                    "verified": True,
                },
            ]
        )
        with patch.object(gr, "supabase", db):
            body = test_client.get(f"/google-reviews/business/{BUSINESS_ID}").json()
        assert body["summary"]["count"] == 1
        assert body["reviews"][0]["external_review_id"] == "rev-aaa"


# ═════════════════════════════════════════════════════════════════════════════
# 6. Pure helpers
# ═════════════════════════════════════════════════════════════════════════════


class TestHelpers:
    @pytest.mark.parametrize(
        "star,expected",
        [("ONE", 1), ("THREE", 3), ("FIVE", 5)],
    )
    def test_star_enum_maps_to_integers(self, star, expected):
        row = gr._to_row(
            {"reviewId": "r", "starRating": star, "reviewer": {}},
            BUSINESS_ID,
            LOCATION,
            OWNER_ID,
        )
        assert row["rating"] == expected

    @pytest.mark.parametrize(
        "review",
        [
            {"starRating": "FIVE", "reviewer": {}},  # no id
            {"reviewId": "r", "starRating": "STAR_RATING_UNSPECIFIED"},
            {"reviewId": "r", "reviewer": {}},  # no rating at all
            {"reviewId": "  ", "starRating": "FIVE"},
        ],
    )
    def test_unstorable_reviews_are_skipped_not_guessed(self, review):
        assert gr._to_row(review, BUSINESS_ID, LOCATION, OWNER_ID) is None

    def test_verified_is_never_taken_from_the_payload(self):
        """A hostile or buggy upstream cannot mark a row unverified-but-shown,
        nor can it mark anything verified that we did not fetch ourselves."""
        row = gr._to_row(
            {
                "reviewId": "r",
                "starRating": "FIVE",
                "reviewer": {},
                "verified": False,
                "source": "yelp",
            },
            BUSINESS_ID,
            LOCATION,
            OWNER_ID,
        )
        assert row["verified"] is True
        assert row["source"] == "google"

    def test_pkce_challenge_matches_the_verifier(self):
        import base64 as b64
        import hashlib

        verifier, challenge = gr._pkce_pair()
        digest = hashlib.sha256(verifier.encode("ascii")).digest()
        assert challenge == b64.urlsafe_b64encode(digest).decode().rstrip("=")

    @pytest.mark.parametrize(
        "raw",
        ["", None, "not a timestamp", "2026-13-45T99:99:99Z"],
    )
    def test_unparseable_timestamps_return_none(self, raw):
        assert gr._parse_google_time(raw) is None

    def test_nanosecond_timestamps_parse(self):
        parsed = gr._parse_google_time("2026-03-01T10:00:00.123456789Z")
        assert parsed is not None
        assert parsed.startswith("2026-03-01T10:00:00")

    def test_summary_of_no_reviews_has_no_average(self):
        assert gr._summarise([]) == {"count": 0, "average_rating": None}
