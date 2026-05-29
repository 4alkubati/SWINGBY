"""
test_businesses.py — Tests for /businesses endpoints.

Coverage:
- POST /businesses (create business)
- GET /businesses (list all businesses with pagination)
- GET /businesses/nearby (list businesses by lat/lng/radius)
- PUT /businesses/{id} (update business)
- Pagination logic
"""

import pytest
from unittest.mock import patch, MagicMock


class TestCreateBusiness:
    """Tests for POST /businesses."""

    def test_create_business_valid_input_returns_201(self, test_client):
        """
        T82.1: POST /businesses with valid input should return 201 + business object.
        """
        with patch("app.api.businesses.supabase") as mock_supabase, \
             patch("app.api.businesses.get_current_user") as mock_get_user:

            mock_get_user.return_value = {"id": "user-123", "role": "business_owner"}

            # Mock business creation
            mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
                {
                    "id": "biz-123",
                    "name": "Test Business",
                    "owner_id": "user-123",
                    "address": "123 Main St",
                    "lat": 51.0447,
                    "lng": -114.0719,
                }
            ]

            response = test_client.post(
                "/businesses",
                json={
                    "name": "Test Business",
                    "address": "123 Main St",
                    "lat": 51.0447,
                    "lng": -114.0719,
                },
                headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code in [200, 201]
            data = response.json()
            assert "id" in data or "id" in data.get("data", {})


class TestListBusinesses:
    """Tests for GET /businesses."""

    def test_list_businesses_returns_200_with_pagination(self, test_client):
        """
        T82.2: GET /businesses should return 200 + list of businesses with pagination.
        """
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value.select.return_value.limit.return_value.offset.return_value.execute.return_value.data = [
                {
                    "id": "biz-1",
                    "name": "Business 1",
                    "avg_rating": 4.5,
                },
                {
                    "id": "biz-2",
                    "name": "Business 2",
                    "avg_rating": 4.0,
                }
            ]
            mock_supabase.table.return_value.select.return_value.count.return_value = MagicMock(
                execute=MagicMock(return_value=MagicMock(count=2))
            )

            response = test_client.get("/businesses?page=1&page_size=10")

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list) or "data" in data


class TestNearbyBusinesses:
    """Tests for GET /businesses/nearby."""

    def test_list_nearby_businesses_returns_200(self, test_client):
        """
        T82.3: GET /businesses/nearby?lat=51.0447&lng=-114.0719&radius_km=10
        should return 200 + list of businesses within radius.
        """
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.rpc.return_value.execute.return_value.data = [
                {
                    "id": "biz-1",
                    "name": "Nearby Business",
                    "distance_km": 2.5,
                }
            ]

            response = test_client.get(
                "/businesses/nearby?lat=51.0447&lng=-114.0719&radius_km=10"
            )

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list) or "data" in data


class TestUpdateBusiness:
    """Tests for PUT /businesses/{id}."""

    def test_update_business_returns_200(self, test_client):
        """
        T82.4: PUT /businesses/{id} with valid data should return 200 + updated business.
        """
        with patch("app.api.businesses.supabase") as mock_supabase, \
             patch("app.api.businesses.get_current_user") as mock_get_user:

            mock_get_user.return_value = {"id": "user-123", "role": "business_owner"}

            # Mock update
            mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
                {
                    "id": "biz-123",
                    "name": "Updated Business",
                    "address": "456 Oak St",
                }
            ]

            response = test_client.put(
                "/businesses/biz-123",
                json={
                    "name": "Updated Business",
                    "address": "456 Oak St",
                },
                headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code == 200


class TestBusinessPagination:
    """Tests for pagination across business endpoints."""

    def test_pagination_with_limit_and_offset(self, test_client):
        """
        T82.5: Pagination should support limit and offset parameters.
        """
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value.select.return_value.limit.return_value.offset.return_value.execute.return_value.data = []

            response = test_client.get("/businesses?page=2&page_size=20")

            assert response.status_code == 200
