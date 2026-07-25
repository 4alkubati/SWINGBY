"""
test_search_result_integrity.py — audit L8: "5 results" then six businesses.

WHAT I COULD AND COULD NOT REPRODUCE
    `GET /businesses/?q=` returns no count at all — `{items, limit, offset,
    next_offset}` — and the search screen derives its "N RESULTS" eyebrow from
    `results.length`, the same array it renders. Count and list therefore
    cannot disagree unless the list itself carries the same business twice.

    Against the live database (project ulnxapnsenzyddddldjt, 2026-07-24) the
    ranking RPC `search_businesses_by_work('cleaning', null, 200)` returns 7
    rows / 7 distinct business ids — no duplicates today. It DOES return
    businesses with no matching completed work (Bridgeland Brushworks, Bow
    Ridge Lawn & Yard, Hillhurst Snow & Ice), which is the audit's "including
    businesses with no jobs": the corpus deliberately includes each business's
    own profile text at tsvector weight 'B', and a trigram similarity ≥ 0.45
    against the whole corpus is also a match. That is by design, not a leak.

    So the duplicate could not be reproduced from data. What this file pins is
    the guard: whatever the ranker returns, the endpoint emits each business at
    most once, so the count a client computes always matches the rows it drew.
"""

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

CLIENT = {"id": "client-1", "role": "client"}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


def _biz(bid, name):
    return {
        "id": bid,
        "owner_id": f"owner-{bid}",
        "business_name": name,
        "category": "Cleaning",
        "lat": 51.05,
        "lng": -114.07,
    }


class TestSearchNeverListsABusinessTwice:
    def test_duplicate_ranked_ids_collapse_to_one_row(self, test_client, as_client):
        ranked = [
            {"business_id": "b1", "match_score": 9.0, "match_reason": None},
            {"business_id": "b2", "match_score": 5.0, "match_reason": None},
            # The ranker hands back b1 a second time (e.g. a future join over
            # completed bookings). The response must not grow a sixth card.
            {"business_id": "b1", "match_score": 4.0, "match_reason": None},
        ]
        hydrated = SupabaseTableStub(
            select_data=[_biz("b1", "Alpha Clean"), _biz("b2", "Beta Clean")]
        )

        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = hydrated
            with patch(
                "app.api.businesses.search_index.rank_business_ids",
                return_value=ranked,
            ):
                with patch("app.api.businesses.hidden_user_ids", return_value=set()):
                    response = test_client.get(
                        "/businesses/?q=cleaning",
                        headers={"Authorization": "Bearer test-token"},
                    )

        assert response.status_code == 200
        items = response.json()["items"]
        assert [i["id"] for i in items] == ["b1", "b2"]
        assert len(items) == len({i["id"] for i in items})

    def test_rank_order_is_preserved(self, test_client, as_client):
        ranked = [
            {"business_id": "b2", "match_score": 9.0, "match_reason": None},
            {"business_id": "b1", "match_score": 1.0, "match_reason": None},
        ]
        hydrated = SupabaseTableStub(
            select_data=[_biz("b1", "Alpha Clean"), _biz("b2", "Beta Clean")]
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = hydrated
            with patch(
                "app.api.businesses.search_index.rank_business_ids",
                return_value=ranked,
            ):
                with patch("app.api.businesses.hidden_user_ids", return_value=set()):
                    response = test_client.get(
                        "/businesses/?q=cleaning",
                        headers={"Authorization": "Bearer test-token"},
                    )
        assert [i["id"] for i in response.json()["items"]] == ["b2", "b1"]

    def test_ghosted_owner_is_dropped_from_the_list(self, test_client, as_client):
        ranked = [
            {"business_id": "b1", "match_score": 9.0, "match_reason": None},
            {"business_id": "b2", "match_score": 5.0, "match_reason": None},
        ]
        hydrated = SupabaseTableStub(
            select_data=[_biz("b1", "Alpha Clean"), _biz("b2", "Beta Clean")]
        )
        with patch("app.api.businesses.supabase") as mock_supabase:
            mock_supabase.table.return_value = hydrated
            with patch(
                "app.api.businesses.search_index.rank_business_ids",
                return_value=ranked,
            ):
                with patch(
                    "app.api.businesses.hidden_user_ids", return_value={"owner-b2"}
                ):
                    response = test_client.get(
                        "/businesses/?q=cleaning",
                        headers={"Authorization": "Bearer test-token"},
                    )
        assert [i["id"] for i in response.json()["items"]] == ["b1"]
