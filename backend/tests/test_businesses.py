"""
test_businesses.py — Tests for /businesses endpoints.

Coverage:
- POST /businesses/ (create business)
- GET /businesses/ (list businesses, limit/offset pagination)
- GET /businesses/nearby (geo-browse by lat/lng/radius)
- PATCH /businesses/{id} (update business)

All routes require auth; get_current_user is replaced via FastAPI
dependency_overrides (patching the module attribute does not work because
Depends() captured the reference at import time).
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


@pytest.fixture
def as_owner():
    app.dependency_overrides[get_current_user] = lambda: OWNER
    yield OWNER
    app.dependency_overrides.pop(get_current_user, None)


class TestCreateBusiness:
    """Tests for POST /businesses/."""

    def test_create_business_valid_input_returns_201(self, test_client, as_owner):
        """
        T82.1: POST /businesses/ with valid input returns the created business.
        """
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=[],  # no existing business for this owner
                insert_data=[
                    {
                        "id": "biz-123",
                        "business_name": "Test Business",
                        "owner_id": "user-123",
                        "category": "cleaning",
                    }
                ],
            )

            response = test_client.post(
                "/businesses/",
                json={"business_name": "Test Business", "category": "cleaning"},
                headers={"Authorization": "Bearer test-token"},
            )

            assert response.status_code in [200, 201]
            data = response.json()
            assert data["business"]["id"] == "biz-123"


class TestListBusinesses:
    """Tests for GET /businesses/."""

    def test_list_businesses_returns_200_with_pagination(self, test_client, as_owner):
        """
        T82.2: GET /businesses/ returns items + limit/offset pagination fields.
        """
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=[
                    {"id": "biz-1", "business_name": "Business 1", "avg_rating": 4.5},
                    {"id": "biz-2", "business_name": "Business 2", "avg_rating": 4.0},
                ]
            )

            response = test_client.get("/businesses/?limit=10&offset=0")

            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) == 2
            assert data["limit"] == 10
            assert data["offset"] == 0

    def test_lowercase_category_chip_id_matches_capitalized_label(
        self, test_client, as_owner
    ):
        """
        DQ-1 regression: CategoryScroll sends the lowercase chip `id` (e.g.
        "cleaning") but businesses.category stores the capitalized canonical
        `label` (e.g. "Cleaning"). The filter must be case-insensitive (ilike),
        matching the Phase CAT idiom in service_posts.py::list_open_posts —
        not an exact .eq() which would return zero results.
        """
        stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "biz-1",
                    "business_name": "Test Cleaning Co.",
                    "category": "Cleaning",
                }
            ]
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get("/businesses/", params={"category": "cleaning"})

            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) == 1

            ilike_calls = [c for c in stub.calls if c[0] == "ilike"]
            assert ilike_calls, "expected an ilike() call for ?category= filter"
            name, args, _kwargs = ilike_calls[0]
            assert args[0] == "category"
            assert args[1] == "cleaning"
            eq_calls = [c for c in stub.calls if c[0] == "eq"]
            assert not eq_calls, "category filter must not use exact .eq() match"


class TestBusinessNameSearch:
    """Tests for GET /businesses/?q= — DQ-1 name-based search (no location)."""

    def _find_ilike(self, stub):
        for name, args, _kwargs in stub.calls:
            if name == "ilike":
                return args
        return None

    def test_name_search_calls_ilike_and_requires_no_location(
        self, test_client, as_owner
    ):
        """
        DQ-1.1: GET /businesses/?q=<name> issues a case-insensitive ilike on
        business_name and returns 200 without any lat/lng location param.
        """
        stub = SupabaseTableStub(
            select_data=[
                {"id": "biz-1", "business_name": "Test Cleaning Co.", "avg_rating": 4.5}
            ]
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get("/businesses/?q=Cleaning")

            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) == 1

            ilike_args = self._find_ilike(stub)
            assert ilike_args is not None, "expected an ilike() call for ?q= search"
            assert ilike_args[0] == "business_name"
            assert ilike_args[1] == "%Cleaning%"

    def test_name_search_escapes_ilike_special_chars(self, test_client, as_owner):
        """
        DQ-1.2: % _ \\ in the user query are backslash-escaped before building
        the ilike pattern so they can't act as wildcards.
        """
        stub = SupabaseTableStub(select_data=[])
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            # raw query: a%b_c\d
            response = test_client.get("/businesses/", params={"q": "a%b_c\\d"})

            assert response.status_code == 200
            ilike_args = self._find_ilike(stub)
            assert ilike_args is not None
            assert ilike_args[1] == "%a\\%b\\_c\\\\d%"

    def test_no_query_does_not_call_ilike(self, test_client, as_owner):
        """
        DQ-1.3: existing behavior preserved — omitting ?q= issues no ilike.
        """
        stub = SupabaseTableStub(select_data=[])
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get("/businesses/")

            assert response.status_code == 200
            assert self._find_ilike(stub) is None


class TestNearbyBusinesses:
    """Tests for GET /businesses/nearby."""

    def test_list_nearby_businesses_returns_200(self, test_client, as_owner):
        """
        T82.3: GET /businesses/nearby?lat&lng&radius_km returns businesses
        whose service area covers the caller's location.
        """
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=[
                    {
                        "id": "biz-1",
                        "business_name": "Nearby Business",
                        "lat": 51.0447,
                        "lng": -114.0719,
                        "service_radius_km": 25,
                    }
                ]
            )

            response = test_client.get(
                "/businesses/nearby?lat=51.0447&lng=-114.0719&radius_km=10"
            )

            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert isinstance(data["items"], list)

    def test_lowercase_category_chip_id_matches_capitalized_label(
        self, test_client, as_owner
    ):
        """
        DQ-BK1 regression: CategoryScroll sends the lowercase chip `id` (e.g.
        "landscaping") but businesses.category stores the capitalized
        canonical `label` (e.g. "Landscaping"). The nearby filter must be
        case-insensitive (ilike), matching the idiom already used by
        list_businesses (this file, ?category=) and
        service_posts.py::list_open_posts — not an exact .eq() which
        silently returns zero results. The geo/Haversine filtering path is
        untouched: the stubbed business sits exactly at the caller's
        lat/lng so it always passes the distance check regardless of the
        category fix.
        """
        stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "biz-1",
                    "business_name": "Test Landscaping Co.",
                    "category": "Landscaping",
                    "lat": 51.0447,
                    "lng": -114.0719,
                    "service_radius_km": 25,
                }
            ]
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get(
                "/businesses/nearby",
                params={
                    "lat": 51.0447,
                    "lng": -114.0719,
                    "radius_km": 10,
                    "category": "landscaping",
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) == 1
            assert data["items"][0]["id"] == "biz-1"

            ilike_calls = [c for c in stub.calls if c[0] == "ilike"]
            assert ilike_calls, "expected an ilike() call for ?category= filter"
            name, args, _kwargs = ilike_calls[0]
            assert args[0] == "category"
            assert args[1] == "landscaping"
            eq_calls = [c for c in stub.calls if c[0] == "eq"]
            assert not eq_calls, "category filter must not use exact .eq() match"


class TestUpdateBusiness:
    """Tests for PATCH /businesses/{id}."""

    def test_update_business_returns_200(self, test_client, as_owner):
        """
        T82.4: PATCH /businesses/{id} by the owner returns 200.
        """
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data={"owner_id": "user-123"},  # ownership check
                update_data=[
                    {
                        "id": "biz-123",
                        "business_name": "Updated Business",
                        "owner_id": "user-123",
                    }
                ],
            )

            response = test_client.patch(
                "/businesses/biz-123",
                json={"business_name": "Updated Business"},
                headers={"Authorization": "Bearer test-token"},
            )

            assert response.status_code == 200


class TestBusinessPagination:
    """Tests for pagination across business endpoints."""

    def test_pagination_with_limit_and_offset(self, test_client, as_owner):
        """
        T82.5: An empty page returns 200 with next_offset=None.
        """
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(select_data=[])

            response = test_client.get("/businesses/?limit=20&offset=20")

            assert response.status_code == 200
            data = response.json()
            assert data["items"] == []
            assert data["next_offset"] is None


def _multi_table(stubs: dict, default: SupabaseTableStub):
    def _table(name):
        return stubs.get(name, default)

    return _table


class TestAnalyticsRecentReviewsKey:
    """
    GAP-AUDIT-2026-07-18 #62: GET /businesses/me/analytics built recent_reviews
    with `.eq("reviewee_id", uid)` where uid is the business OWNER's user id.
    Business reviews are stored `reviewee_id = business_id`,
    reviewee_type = "business" (reviews.py:58) — the owner's user id never
    matches, so recent_reviews was always empty. Pin the fixed key: query by
    business id + reviewee_type="business", not the owner's user id.
    """

    def test_recent_reviews_query_filters_on_business_id_not_owner_id(
        self, test_client, as_owner
    ):
        businesses_stub = SupabaseTableStub(
            select_data={"id": "biz-1", "avg_rating": 4.5, "review_count": 1}
        )
        bookings_stub = SupabaseTableStub(select_data=[])
        interests_stub = SupabaseTableStub(select_data=[])
        reviews_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "rev-1",
                    "rating": 5,
                    "comment": "Great work",
                    "created_at": "2026-07-01T00:00:00Z",
                    "reviewer_id": "client-9",
                }
            ]
        )
        users_stub = SupabaseTableStub(select_data={"first_name": "Jane"})

        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "businesses": businesses_stub,
                    "bookings": bookings_stub,
                    "interests": interests_stub,
                    "reviews": reviews_stub,
                    "users": users_stub,
                },
                reviews_stub,
            )

            response = test_client.get(
                "/businesses/me/analytics",
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200, response.text

        # Pin the key: reviews queried by business id (not the owner's user
        # id, which is "user-123" per the as_owner fixture) + reviewee_type.
        eq_calls = [c for c in reviews_stub.calls if c[0] == "eq"]
        assert ("reviewee_id", "biz-1") in [c[1] for c in eq_calls]
        assert ("reviewee_type", "business") in [c[1] for c in eq_calls]
        assert ("reviewee_id", "user-123") not in [c[1] for c in eq_calls]

        data = response.json()
        assert len(data["recent_reviews"]) == 1
        assert data["recent_reviews"][0]["client_first_name"] == "Jane"
