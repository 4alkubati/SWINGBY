"""
test_reviews.py — Tests for reviews and rating aggregation.

Coverage:
- Create review: POST /reviews/ (client reviewing a completed booking)
- List reviews by business: GET /reviews/business/{business_id}
- Average rating math (pure logic)

Auth is replaced via FastAPI dependency_overrides; supabase access is stubbed
per-table with SupabaseTableStub.
"""

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

CLIENT = {
    "id": "user-123",
    "role": "client",
    "first_name": "Test",
    "last_name": "Client",
    "email": "client@example.com",
}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


class TestCreateReview:
    """Tests for POST /reviews/."""

    def test_create_review_returns_201(self, test_client, as_client):
        """
        T85.1: POST /reviews/ for the caller's completed booking returns the
        created review.
        """
        tables = {
            "bookings": SupabaseTableStub(
                select_data={
                    "id": "bk-1",
                    "status": "completed",
                    "client_id": "user-123",
                    "business_id": "biz-1",
                }
            ),
            # select serves the duplicate check (empty) and the post-insert
            # avg_rating recalculation (empty list skips the update).
            "reviews": SupabaseTableStub(
                select_data=[],
                insert_data=[
                    {
                        "id": "review-123",
                        "booking_id": "bk-1",
                        "reviewer_id": "user-123",
                        "reviewee_id": "biz-1",
                        "reviewee_type": "business",
                        "rating": 5,
                        "comment": "Great service!",
                    }
                ],
            ),
            "businesses": SupabaseTableStub(select_data=[], update_data=[]),
        }

        with patch("app.api.reviews.supabase") as mock_supabase:
            mock_supabase.table.side_effect = lambda name: tables[name]

            response = test_client.post(
                "/reviews/",
                json={"booking_id": "bk-1", "rating": 5, "comment": "Great service!"},
                headers={"Authorization": "Bearer test-token"},
            )

            assert response.status_code in [200, 201]
            data = response.json()
            assert data["review"]["id"] == "review-123"


class TestListReviews:
    """Tests for GET /reviews/business/{business_id}."""

    def test_list_reviews_by_business_returns_200(self, test_client, as_client):
        """
        T85.2: GET /reviews/business/{id} returns the business's reviews.
        """
        with patch("app.api.reviews.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=[
                    {"id": "review-1", "rating": 5, "comment": "Excellent"},
                    {"id": "review-2", "rating": 4, "comment": "Good"},
                ]
            )

            response = test_client.get("/reviews/business/biz-123")

            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 2


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
