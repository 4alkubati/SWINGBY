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
