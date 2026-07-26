"""
test_business_logo.py — businesses.logo_url (business visual identity).

`businesses` had no image column at all, so a business was a name and a
category everywhere it appeared while clients and employees both had avatars.
This pins the four things that can actually go wrong with the column that fixes
that:

1. only the OWNING owner can set it, resolved from the database and never from
   the business id in the URL;
2. the value must be an absolute http(s) URL, because it is rendered straight
   into an <Image> on every client;
3. the API does not fall over when migration 20260726120000 has been filed but
   not yet applied — including the case where a logo rides along with an
   unrelated edit that must still save;
4. `logo_url` is always present in the response shape, applied or not.
"""

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

OWNER = {
    "id": "user-123",
    "role": "business_owner",
    "first_name": "Test",
    "last_name": "Owner",
    "email": "owner@example.com",
}

OTHER_OWNER = {**OWNER, "id": "user-999", "email": "other@example.com"}

CLIENT = {**OWNER, "id": "user-777", "role": "client", "email": "client@example.com"}

LOGO = "https://stub.supabase.co/storage/v1/object/public/job-photos/posts/a/b.png"

# What PostgREST answers when a write names a column the table does not have.
MISSING_COLUMN_ERROR = (
    "{'code': 'PGRST204', 'message': \"Could not find the 'logo_url' column "
    "of 'businesses' in the schema cache\"}"
)


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture
def as_owner():
    _override(OWNER)
    yield OWNER
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_other_owner():
    _override(OTHER_OWNER)
    yield OTHER_OWNER
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_client_role():
    _override(CLIENT)
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


class _NoLogoColumnStub(SupabaseTableStub):
    """
    A `businesses` table that predates the logo_url migration.

    Any insert/update whose payload names `logo_url` fails the way PostgREST
    actually fails it; the same write without that key succeeds. Records every
    write payload so a test can prove which one reached the database.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.writes = []

    def insert(self, payload, *args, **kwargs):
        self.calls.append(("insert", (payload,), kwargs))
        self.inserted = payload
        self._mode = "insert"
        self.writes.append(payload)
        return self

    def update(self, payload, *args, **kwargs):
        self.calls.append(("update", (payload,), kwargs))
        self._mode = "update"
        self.writes.append(payload)
        return self

    def execute(self):
        self.calls.append(("execute", (), {}))
        if self._mode in ("insert", "update") and "logo_url" in (self.writes[-1] or {}):
            raise Exception(MISSING_COLUMN_ERROR)
        data = self._data[self._mode]
        count = len(data) if isinstance(data, list) else None
        from types import SimpleNamespace

        return SimpleNamespace(data=data, count=count)


class TestOwnershipIsResolvedServerSide:
    """The business id in the URL is a lookup key, never a claim of ownership."""

    def test_owner_can_set_own_logo(self, test_client, as_owner):
        stub = SupabaseTableStub(
            select_data={"owner_id": "user-123"},
            update_data=[
                {"id": "biz-123", "owner_id": "user-123", "logo_url": LOGO},
            ],
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/businesses/biz-123",
                json={"logo_url": LOGO},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        assert response.json()["business"]["logo_url"] == LOGO
        # The logo actually reached the write, rather than being validated and
        # then dropped on the floor.
        update_calls = [c for c in stub.calls if c[0] == "update"]
        assert update_calls and update_calls[0][1][0]["logo_url"] == LOGO

    def test_a_different_owner_cannot_set_this_businesss_logo(
        self, test_client, as_other_owner
    ):
        """
        The attack this closes: any business owner PATCHing someone else's
        business id with their own logo. Ownership comes from the row, so the
        request is refused and no update is issued at all.
        """
        stub = SupabaseTableStub(
            select_data={"owner_id": "user-123"},  # owned by somebody else
            update_data=[{"id": "biz-123"}],
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/businesses/biz-123",
                json={"logo_url": LOGO},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 403
        assert not [c for c in stub.calls if c[0] == "update"]

    def test_client_role_cannot_set_a_logo(self, test_client, as_client_role):
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data={"owner_id": "user-777"}
            )

            response = test_client.patch(
                "/businesses/biz-123",
                json={"logo_url": LOGO},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 403


class TestLogoUrlValidation:
    """The value lands in an <Image> source, so the scheme is not negotiable."""

    @pytest.mark.parametrize(
        "bad",
        [
            "javascript:alert(1)",
            "data:image/png;base64,iVBORw0KGgo=",
            "file:///etc/passwd",
            "not a url at all",
            "/relative/path.png",
        ],
    )
    def test_non_http_urls_are_rejected(self, test_client, as_owner, bad):
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data={"owner_id": "user-123"}
            )

            response = test_client.patch(
                "/businesses/biz-123",
                json={"logo_url": bad},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 422

    def test_oversized_url_is_rejected(self, test_client, as_owner):
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data={"owner_id": "user-123"}
            )

            response = test_client.patch(
                "/businesses/biz-123",
                json={"logo_url": "https://x.co/" + "a" * 3000},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 422

    def test_create_accepts_a_logo_url(self, test_client, as_owner):
        stub = SupabaseTableStub(
            select_data=[],
            insert_data=[
                {"id": "biz-1", "owner_id": "user-123", "logo_url": LOGO},
            ],
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.post(
                "/businesses/",
                json={
                    "business_name": "Calgary Clean Co.",
                    "category": "cleaning",
                    "logo_url": LOGO,
                },
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code in (200, 201)
        assert response.json()["business"]["logo_url"] == LOGO
        assert stub.inserted["logo_url"] == LOGO
        # owner_id is always the caller's, never anything the client sent.
        assert stub.inserted["owner_id"] == "user-123"


class TestUnappliedMigrationCannotBreakAnything:
    """
    Migrations ship with the code, so there is a window where this endpoint is
    live against a `businesses` table with no logo_url column. Nothing in that
    window may 500, and nothing unrelated to the logo may be lost.
    """

    def test_rename_still_saves_when_the_logo_column_is_missing(
        self, test_client, as_owner
    ):
        """
        The expensive failure: an owner renames their business AND picks a logo
        in one save. The logo cannot be stored yet — the rename still must be.
        """
        stub = _NoLogoColumnStub(
            select_data={"owner_id": "user-123"},
            update_data=[{"id": "biz-123", "business_name": "New Name"}],
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/businesses/biz-123",
                json={"business_name": "New Name", "logo_url": LOGO},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        assert response.json()["business"]["business_name"] == "New Name"
        # Retried without the logo, keeping the rename.
        assert stub.writes[-1] == {"business_name": "New Name"}
        # And the response still carries the key, as None.
        assert response.json()["business"]["logo_url"] is None

    def test_logo_only_update_degrades_to_503_not_500(self, test_client, as_owner):
        stub = _NoLogoColumnStub(
            select_data={"owner_id": "user-123"},
            update_data=[{"id": "biz-123"}],
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/businesses/biz-123",
                json={"logo_url": LOGO},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 503

    def test_signup_still_creates_the_business(self, test_client, as_owner):
        """A missing decoration must never cost a business its existence."""
        stub = _NoLogoColumnStub(
            select_data=[],
            insert_data=[{"id": "biz-1", "business_name": "Calgary Clean Co."}],
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.post(
                "/businesses/",
                json={
                    "business_name": "Calgary Clean Co.",
                    "category": "cleaning",
                    "logo_url": LOGO,
                },
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code in (200, 201)
        assert response.json()["business"]["id"] == "biz-1"
        assert "logo_url" not in stub.writes[-1]

    def test_a_real_write_error_is_not_swallowed(self, test_client, as_owner):
        """
        The retry is narrow on purpose. An unrelated database failure on a
        request that happens to carry a logo must still fail.
        """

        class _AlwaysFails(SupabaseTableStub):
            def execute(self):
                if self._mode == "update":
                    raise Exception("deadlock detected")
                from types import SimpleNamespace

                return SimpleNamespace(data=self._data[self._mode], count=None)

        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = _AlwaysFails(
                select_data={"owner_id": "user-123"}
            )

            response = test_client.patch(
                "/businesses/biz-123",
                json={"logo_url": LOGO},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 400


class TestResponseShapeIsStable:
    """`logo_url` is in the payload whether or not the column exists."""

    def test_get_business_includes_logo_url_when_column_absent(
        self, test_client, as_owner
    ):
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data={"id": "biz-123", "business_name": "Calgary Clean Co."}
            )

            response = test_client.get(
                "/businesses/biz-123", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        assert response.json()["logo_url"] is None

    def test_get_my_business_passes_the_stored_logo_through(
        self, test_client, as_owner
    ):
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data={"id": "biz-123", "logo_url": LOGO}
            )

            response = test_client.get(
                "/businesses/me", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        assert response.json()["logo_url"] == LOGO
