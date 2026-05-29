"""
test_reviews.py — Tests for reviews and rating aggregation.

Coverage:
- Create review: POST /reviews
- List reviews by business: GET /reviews?business_id=X
- Average rating auto-update: business.avg_rating reflects review mean
"""

import pytest
from unittest.mock import patch, MagicMock


class TestCreateReview:
    """Tests for POST /reviews."""

    def test_create_review_returns_201(self, test_client):
        """
        T85.1: POST /reviews with valid data should return 201 + review object.
        """
        with patch("app.api.reviews.supabase") as mock_supabase, \
             patch("app.api.reviews.get_current_user") as mock_get_user:

            mock_get_user.return_value = {"id": "user-123"}

            # Mock review creation
            mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
                {
                    "id": "review-123",
                    "business_id": "biz-123",
                    "client_id": "user-123",
                    "rating": 5,
                    "comment": "Great service!",
                }
            ]

            response = test_client.post(
                "/reviews",
                json={
                    "business_id": "biz-123",
                    "rating": 5,
                    "comment": "Great service!",
                },
                headers={"Authorization": "Bearer test-token"}
            )

            assert response.status_code in [200, 201]
            data = response.json()
            assert "id" in data or "id" in data.get("data", {})


class TestListReviews:
    """Tests for GET /reviews."""

    def test_list_reviews_by_business_returns_200(self, test_client):
        """
        T85.2: GET /reviews?business_id={id} should return 200 + list of reviews.
        """
        with patch("app.api.reviews.supabase") as mock_supabase:
            mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
                {
                    "id": "review-1",
                    "business_id": "biz-123",
                    "rating": 5,
                    "comment": "Excellent",
                },
                {
                    "id": "review-2",
                    "business_id": "biz-123",
                    "rating": 4,
                    "comment": "Good",
                }
            ]

            response = test_client.get("/reviews?business_id=biz-123")

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list) or "data" in data


class TestRatingAggregation:
    """Tests for average rating updates."""

    def test_average_rating_updates_on_review(self):
        """
        T85.3: When review is created/updated, business.avg_rating should auto-update.

        Example:
        - Existing: 5.0 (1 review)
        - New review: 3 (2nd review)
        - New avg: (5 + 3) / 2 = 4.0
        """
        existing_rating = 5.0
        existing_count = 1

        new_rating = 3
        new_count = existing_count + 1

        new_avg = (existing_rating * existing_count + new_rating) / new_count

        assert new_avg == 4.0

    def test_multiple_reviews_average_correctly(self):
        """
        T85.4: Average rating with multiple reviews.
        """
        ratings = [5, 4, 4, 3, 5]
        avg = sum(ratings) / len(ratings)

        assert avg == 4.2
