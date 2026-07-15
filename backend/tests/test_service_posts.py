"""
test_service_posts.py — Tests for /service-posts endpoints, category matching.

Coverage:
- GET /service-posts/ business-owner auto-filter (own + related + General)
- GET /service-posts/ degrade-to-unfiltered paths (no business row, bad category)
- GET /service-posts/ client role (no auto-filter)
- GET /service-posts/ explicit ?category= param takes precedence (ilike, no or_)
- POST /service-posts/ normalizes category on create
- app.categories unit tests: RELATED symmetry, normalize_category

All routes require auth; get_current_user is replaced via FastAPI
dependency_overrides (patching the module attribute does not work because
Depends() captured the reference at import time).
"""

from unittest.mock import patch

import pytest

from app.categories import CANONICAL_CATEGORIES, RELATED, normalize_category
from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

OWNER_HANDYMAN = {
    "id": "owner-1",
    "role": "business_owner",
    "first_name": "Handy",
    "last_name": "Owner",
    "email": "handy@example.com",
}

CLIENT = {
    "id": "client-1",
    "role": "client",
    "first_name": "Test",
    "last_name": "Client",
    "email": "client@example.com",
}


@pytest.fixture
def as_owner():
    app.dependency_overrides[get_current_user] = lambda: OWNER_HANDYMAN
    yield OWNER_HANDYMAN
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


def _get_or_call(stub):
    """Return the (name, args, kwargs) tuple for the or_ call, or None."""
    for call in stub.calls:
        if call[0] == "or_":
            return call
    return None


def _get_ilike_calls(stub):
    return [call for call in stub.calls if call[0] == "ilike"]


class TestBusinessOwnerAutoFilter:
    """GET /service-posts/ with no category param, caller is a business_owner."""

    def test_handyman_owner_gets_related_categories_or_filter(
        self, test_client, as_owner
    ):
        """
        Business owner with category "Handyman" and no ?category= param should
        get an or_ filter covering Handyman + Carpentry + Painting + Plumbing
        + Electrical + General.
        """
        businesses_stub = SupabaseTableStub(select_data=[{"category": "Handyman"}])
        posts_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [posts_stub, businesses_stub]

            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code == 200
            or_call = _get_or_call(posts_stub)
            assert or_call is not None
            filter_str = or_call[1][0]
            for term in [
                "category.ilike.Handyman",
                "category.ilike.Carpentry",
                "category.ilike.Painting",
                "category.ilike.Plumbing",
                "category.ilike.Electrical",
                "category.ilike.General",
            ]:
                assert term in filter_str

    def test_no_business_row_degrades_to_unfiltered(self, test_client, as_owner):
        """No business row for this owner -> no or_ filter applied; still 200."""
        businesses_stub = SupabaseTableStub(select_data=[])
        posts_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [posts_stub, businesses_stub]

            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code == 200
            assert _get_or_call(posts_stub) is None

    def test_bad_category_guard_degrades_to_unfiltered(self, test_client, as_owner):
        """Category fails ^[A-Za-z ]+$ guard -> no or_ filter applied; still 200."""
        businesses_stub = SupabaseTableStub(select_data=[{"category": "Weird;DROP"}])
        posts_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [posts_stub, businesses_stub]

            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code == 200
            assert _get_or_call(posts_stub) is None

    def test_business_lookup_raises_degrades_to_unfiltered(self, test_client, as_owner):
        """Business lookup raising an exception must not 500 the feed."""
        posts_stub = SupabaseTableStub(select_data=[])

        def _raising_table(name):
            if name == "businesses":
                raise RuntimeError("boom")
            return posts_stub

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _raising_table

            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code == 200
            assert _get_or_call(posts_stub) is None


class TestClientRoleNoAutoFilter:
    """GET /service-posts/ as a client -> no business lookup, no or_."""

    def test_client_role_no_business_lookup_no_or_filter(self, test_client, as_client):
        posts_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = posts_stub

            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code == 200
            assert _get_or_call(posts_stub) is None
            # Only one table() call expected (service_posts) — no businesses lookup.
            assert mock_supabase.table.call_count == 1


class TestExplicitCategoryParamPrecedence:
    """GET /service-posts/?category=... takes precedence over the auto-filter."""

    def test_category_param_uses_ilike_and_skips_or_filter(self, test_client, as_owner):
        posts_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = posts_stub

            response = test_client.get(
                "/service-posts/?category=cleaning",
                headers={"Authorization": "Bearer test-token"},
            )

            assert response.status_code == 200
            ilike_calls = _get_ilike_calls(posts_stub)
            assert len(ilike_calls) == 1
            assert ilike_calls[0][1] == ("category", "cleaning")
            assert _get_or_call(posts_stub) is None
            # Param precedence: no businesses lookup at all.
            assert mock_supabase.table.call_count == 1


class TestCreateServicePostNormalizesCategory:
    """POST /service-posts/ normalizes the stored category."""

    def test_create_post_normalizes_lowercase_category(self, test_client, as_client):
        posts_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": "post-1",
                    "client_id": "client-1",
                    "title": "Need a cleaner",
                    "category": "Cleaning",
                    "budget": 100,
                    "status": "open",
                }
            ]
        )

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = posts_stub

            response = test_client.post(
                "/service-posts/",
                json={
                    "title": "Need a cleaner",
                    "category": "cleaning",
                    "budget": 100,
                },
                headers={"Authorization": "Bearer test-token"},
            )

            assert response.status_code in [200, 201]
            assert posts_stub.inserted["category"] == "Cleaning"


class TestCategoriesUnit:
    """Unit tests on app.categories — no HTTP involved."""

    def test_related_is_symmetric_and_keys_are_canonical(self):
        assert set(RELATED.keys()) == set(CANONICAL_CATEGORIES)
        for a, related in RELATED.items():
            for b in related:
                assert a in RELATED[b], f"RELATED not symmetric for {a} <-> {b}"

    def test_normalize_category_snaps_case_and_passes_through_unknown(self):
        assert normalize_category("cleaning") == "Cleaning"
        assert normalize_category(" CLEANING ") == "Cleaning"
        assert normalize_category("Cleaning") == "Cleaning"
        assert normalize_category("Massage") == "Massage"
