"""
test_search_index.py — LANE F: work-history ("semantic-ish") business search.

The behaviour under test is the owner's ask: typing a keyword like "big house"
must surface businesses that PROBABLY DID THE SAME KIND OF JOB, and must NOT
surface unrelated ones. Coverage:

- app.services.search_index.lexical_rank — the pure ranker behind the
  in-process fallback (tier 3). Seeded with realistic completed-job text.
- GET /businesses/?q= — that a work-history term returns the business that
  completed a matching job and not the unrelated ones, that category and
  radius filters still apply alongside q, and that the endpoint degrades
  instead of 500ing when the work-index RPC is missing.

The LIVE ranking path is Postgres (weighted tsvector + pg_trgm via the
`search_businesses_by_work` RPC); these tests exercise the RPC contract and the
pure-Python fallback. The SQL ranking itself is verified against the live
database — see docs/business_work_index.sql and the PR description.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from app.services import search_index
from tests.conftest import SupabaseTableStub

CLIENT = {
    "id": "user-client-1",
    "role": "client",
    "first_name": "Test",
    "last_name": "Client",
    "email": "client@example.com",
}

# Three businesses with realistic completed-work corpora. Only the first has
# ever done a big-house job.
BIZ_DEEP_CLEAN = {
    "id": "biz-deepclean",
    "owner_id": "owner-1",
    "business_name": "Bow River Cleaning",
    "category": "Cleaning",
    "description": "Deep clean of a big house before move-out, 4 bedrooms 2 baths",
    "lat": 51.0447,
    "lng": -114.0719,
    "service_radius_km": 25.0,
    "avg_rating": 4.9,
}
BIZ_WINDOWS = {
    "id": "biz-windows",
    "owner_id": "owner-2",
    "business_name": "Sparkle Co.",
    "category": "Cleaning",
    "description": "Office window washing for downtown towers, commercial glass",
    "lat": 51.0500,
    "lng": -114.0800,
    "service_radius_km": 25.0,
    "avg_rating": 4.7,
}
BIZ_LAWN = {
    "id": "biz-lawn",
    "owner_id": "owner-3",
    "business_name": "Greenland Lawncare",
    "category": "Landscaping",
    "description": "Lawn mowing and hedge trimming for corner lots",
    "lat": 52.5000,  # ~160 km north — outside a 25 km radius
    "lng": -114.0719,
    "service_radius_km": 25.0,
    "avg_rating": 4.2,
}
ALL_BUSINESSES = [BIZ_DEEP_CLEAN, BIZ_WINDOWS, BIZ_LAWN]


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


class RpcStub:
    """
    Stand-in for supabase.rpc(name, params).execute().

    `handler(name, params) -> list[dict]` produces the rows; raising from the
    handler simulates the RPC being absent (migration not applied), which is
    what drives the endpoint's in-process fallback.
    """

    def __init__(self, handler):
        self._handler = handler
        self.calls = []

    def __call__(self, name, params=None):
        self.calls.append((name, params))
        self._name, self._params = name, params
        return self

    def execute(self):
        return SimpleNamespace(data=self._handler(self._name, self._params))


def _work_rank(query, businesses=ALL_BUSINESSES, category=None):
    """Rank with the real pure ranker — stands in for the SQL ranking in tests."""
    rows = businesses
    if category:
        rows = [b for b in rows if b["category"].lower() == category.lower()]
    return search_index.rank_businesses_in_process(query, rows)


# ── The pure ranker ──────────────────────────────────────────────────────────


class TestLexicalRank:
    """app.services.search_index.lexical_rank — real logic, no mocks."""

    def test_work_history_term_matches_the_business_that_did_that_job(self):
        """LANE F.1: 'big house' scores the deep-clean corpus, not the others."""
        q = "big house"
        assert (
            search_index.lexical_rank(
                q, search_index.corpus_from_business(BIZ_DEEP_CLEAN)
            )
            > 0
        )
        assert (
            search_index.lexical_rank(q, search_index.corpus_from_business(BIZ_WINDOWS))
            == 0
        )
        assert (
            search_index.lexical_rank(q, search_index.corpus_from_business(BIZ_LAWN))
            == 0
        )

    def test_ranks_the_better_match_higher(self):
        """LANE F.2: more query terms covered ⇒ higher score."""
        both = search_index.lexical_rank(
            "move out cleaning", search_index.corpus_from_business(BIZ_DEEP_CLEAN)
        )
        partial = search_index.lexical_rank(
            "move out cleaning", search_index.corpus_from_business(BIZ_WINDOWS)
        )
        assert both > partial > 0

    def test_stems_so_cleaning_matches_clean(self):
        """LANE F.3: 'cleaning' must reach a corpus that says 'clean'."""
        assert search_index.lexical_rank("cleaning", "Deep clean of a big house") > 0

    def test_stopwords_alone_match_nothing(self):
        """LANE F.4: a query of pure stopwords must not match everything."""
        assert search_index.lexical_rank("the and of", "Deep clean of a big house") == 0

    def test_empty_query_or_corpus_scores_zero(self):
        assert search_index.lexical_rank("", "Deep clean of a big house") == 0
        assert search_index.lexical_rank("big house", "") == 0

    def test_ranking_drops_non_matches_entirely(self):
        """LANE F.5: unrelated businesses are excluded, not merely tail-ranked."""
        ranked = search_index.rank_businesses_in_process("big house", ALL_BUSINESSES)
        assert [r["business_id"] for r in ranked] == ["biz-deepclean"]


class TestSemanticFlag:
    """The dormant semantic path stays off until a provider is provisioned."""

    def test_semantic_is_off_by_default(self):
        assert search_index.SEMANTIC_SEARCH_ENABLED is False
        assert search_index.semantic_search_available() is False

    def test_flag_alone_does_not_enable_semantic_without_a_key(self):
        """LANE F.6: flipping the flag with no provider must not activate it."""
        with patch.object(search_index, "SEMANTIC_SEARCH_ENABLED", True), patch.object(
            search_index, "SEARCH_EMBEDDING_API_KEY", ""
        ):
            assert search_index.semantic_search_available() is False

    def test_embedding_call_fails_loudly_rather_than_silently(self):
        with pytest.raises(search_index.EmbeddingUnavailable):
            search_index.embed_texts(["big house"])


# ── The endpoint ─────────────────────────────────────────────────────────────


class TestWorkHistorySearchEndpoint:
    """GET /businesses/?q= — work-history ranking, filters, and degradation."""

    def _run(self, test_client, url, rpc_handler, table_data=ALL_BUSINESSES):
        with patch("app.api.businesses.supabase") as mock_supabase, patch(
            "app.api.businesses.hidden_user_ids", return_value=set()
        ):
            rpc = RpcStub(rpc_handler)
            mock_supabase.rpc = rpc
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=list(table_data)
            )
            response = test_client.get(url, headers={"Authorization": "Bearer t"})
        return response, rpc

    def test_query_returns_the_matching_business_and_not_the_others(
        self, test_client, as_client
    ):
        """
        LANE F.7: 'big house' returns the business that completed a matching
        job and excludes the window-washing and lawn-care businesses.
        """
        response, rpc = self._run(
            test_client,
            "/businesses/?q=big+house",
            lambda name, params: _work_rank(params["p_query"]),
        )

        assert response.status_code == 200
        data = response.json()
        ids = [b["id"] for b in data["items"]]
        assert ids == ["biz-deepclean"]
        assert "biz-windows" not in ids and "biz-lawn" not in ids
        assert data["search_mode"] == "work_lexical"
        assert data["items"][0]["match_score"] > 0

        # It went through the work-history RPC, not a name ilike.
        assert rpc.calls[0][0] == search_index.WORK_SEARCH_RPC
        assert rpc.calls[0][1]["p_query"] == "big house"

    def test_results_are_returned_in_rank_order(self, test_client, as_client):
        """LANE F.8: best work-history match first."""
        response, _ = self._run(
            test_client,
            "/businesses/?q=move+out+cleaning",
            lambda name, params: _work_rank(params["p_query"]),
        )
        items = response.json()["items"]
        assert [b["id"] for b in items] == ["biz-deepclean", "biz-windows"]
        assert items[0]["match_score"] >= items[1]["match_score"]

    def test_category_filter_applies_alongside_q(self, test_client, as_client):
        """LANE F.9: category narrows the ranked set, and is passed to the RPC."""
        response, rpc = self._run(
            test_client,
            "/businesses/?q=cleaning&category=landscaping",
            lambda name, params: _work_rank(
                params["p_query"], category=params["p_category"]
            ),
        )
        assert response.status_code == 200
        assert response.json()["items"] == []
        assert rpc.calls[0][1]["p_category"] == "landscaping"

    def test_radius_filter_applies_alongside_q(self, test_client, as_client):
        """
        LANE F.10: with lat/lng + radius_km, a matching but far-away business is
        dropped and a nearby one keeps its distance_km.
        """
        response, _ = self._run(
            test_client,
            "/businesses/?q=cleaning+lawn&lat=51.0447&lng=-114.0719&radius_km=25",
            lambda name, params: _work_rank(params["p_query"]),
        )
        items = response.json()["items"]
        ids = [b["id"] for b in items]
        assert "biz-lawn" not in ids  # ~160 km away
        assert "biz-deepclean" in ids
        assert items[0]["distance_km"] < 25

    def test_falls_back_in_process_when_the_rpc_is_missing(
        self, test_client, as_client
    ):
        """
        LANE F.11: a database without the work-index migration must still
        return corpus-ranked results — degraded, never a 500.
        """

        def boom(name, params):
            raise RuntimeError("function search_businesses_by_work does not exist")

        response, _ = self._run(test_client, "/businesses/?q=big+house", boom)

        assert response.status_code == 200
        data = response.json()
        assert data["search_mode"] == "name_fallback"
        assert [b["id"] for b in data["items"]] == ["biz-deepclean"]

    def test_no_query_still_lists_businesses(self, test_client, as_client):
        """LANE F.12: the plain listing path is untouched by the search work."""
        response, rpc = self._run(
            test_client, "/businesses/?limit=20", lambda name, params: []
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["items"]) == 3
        assert "search_mode" not in body
        assert rpc.calls == []  # no ranking RPC when there is nothing to rank
