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

from app.categories import (
    CANONICAL_CATEGORIES,
    RELATED,
    normalize_category,
    resolve_create_category,
)
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

    def test_create_post_unknown_category_snaps_to_general(
        self, test_client, as_client
    ):
        """
        UBER-6: an off-taxonomy category (e.g. "Reiki") must be stored as
        "General" on create, not passed through verbatim — see the Amr
        decision in docs/qa-audit-2026-07-16-uber-flow.md. Search
        (?category=) is unaffected — see TestExplicitCategoryParamPrecedence.
        """
        posts_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": "post-2",
                    "client_id": "client-1",
                    "title": "Need a Reiki session",
                    "category": "General",
                    "budget": 80,
                    "status": "open",
                }
            ]
        )

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = posts_stub

            response = test_client.post(
                "/service-posts/",
                json={
                    "title": "Need a Reiki session",
                    "category": "Reiki",
                    "budget": 80,
                },
                headers={"Authorization": "Bearer test-token"},
            )

            assert response.status_code in [200, 201]
            assert posts_stub.inserted["category"] == "General"

    def test_create_post_writes_preferred_date_into_insert_payload(
        self, test_client, as_client
    ):
        """
        GAP-AUDIT-2026-07-18 #63: the wizard collects a preferred date/time
        but ServicePostCreate had no such field and the insert payload never
        carried it, so the value was silently discarded. Pin that POST
        /service-posts/ now accepts preferred_date and writes it into the
        insert dict (list/detail already return it via select("*") once the
        FILED migration in docs/service_posts_preferred_date.sql is applied).
        """
        posts_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": "post-3",
                    "client_id": "client-1",
                    "title": "Need a plumber",
                    "category": "Plumbing",
                    "budget": 150,
                    "status": "open",
                    "preferred_date": "2026-08-01T10:00:00Z",
                }
            ]
        )

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = posts_stub

            response = test_client.post(
                "/service-posts/",
                json={
                    "title": "Need a plumber",
                    "category": "Plumbing",
                    "budget": 150,
                    "preferred_date": "2026-08-01T10:00:00Z",
                },
                headers={"Authorization": "Bearer test-token"},
            )

            assert response.status_code in [200, 201]
            assert posts_stub.inserted["preferred_date"] == "2026-08-01T10:00:00Z"
            assert response.json()["post"]["preferred_date"] == "2026-08-01T10:00:00Z"


class TestTargetedBookNow:
    """
    LANE C — direct "Book now". A targeted post (target_business_id set):
      * derives its category from the target business, ignoring any client
        category, and
      * on the feed, reaches ONLY that business, regardless of category, and
        never leaks into another business's feed or a broad category browse.
    """

    def test_create_targeted_post_derives_category_and_sets_target(
        self, test_client, as_client
    ):
        """A targeted post stores the BUSINESS's category and the target id —
        the client is never asked for a category on this flow."""
        businesses_stub = SupabaseTableStub(
            select_data={"id": "biz-9", "category": "Cleaning"}
        )
        posts_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": "post-t1",
                    "client_id": "client-1",
                    "title": "Deep clean please",
                    "category": "Cleaning",
                    "target_business_id": "biz-9",
                    "budget": 120,
                    "status": "open",
                }
            ]
        )

        with patch("app.api.service_posts.supabase") as mock_supabase:
            # order: business lookup (derive category) then service_posts insert
            mock_supabase.table.side_effect = [businesses_stub, posts_stub]

            response = test_client.post(
                "/service-posts/",
                json={
                    "title": "Deep clean please",
                    "budget": 120,
                    "target_business_id": "biz-9",
                },
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code in [200, 201], response.text
        assert posts_stub.inserted["target_business_id"] == "biz-9"
        assert posts_stub.inserted["category"] == "Cleaning"

    def test_create_targeted_post_ignores_client_category_on_mismatch(
        self, test_client, as_client
    ):
        """Even if the client's payload carries a mismatched category, a
        targeted post stores the business's category so it can never be hidden
        from its target by a category mismatch."""
        businesses_stub = SupabaseTableStub(
            select_data={"id": "biz-9", "category": "Cleaning"}
        )
        posts_stub = SupabaseTableStub(
            insert_data=[{"id": "post-t2", "category": "Cleaning"}]
        )

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [businesses_stub, posts_stub]

            response = test_client.post(
                "/service-posts/",
                json={
                    "title": "Deep clean please",
                    "budget": 120,
                    "category": "Plumbing",  # deliberately wrong
                    "target_business_id": "biz-9",
                },
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code in [200, 201], response.text
        assert posts_stub.inserted["category"] == "Cleaning"

    def test_create_targeted_post_unknown_business_404s(self, test_client, as_client):
        businesses_stub = SupabaseTableStub(select_data=None)

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = businesses_stub

            response = test_client.post(
                "/service-posts/",
                json={
                    "title": "Deep clean please",
                    "budget": 120,
                    "target_business_id": "does-not-exist",
                },
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 404

    def test_create_open_post_without_category_or_target_rejected(
        self, test_client, as_client
    ):
        """An open post (no target) must still carry a category — the
        model validator rejects a payload with neither."""
        response = test_client.post(
            "/service-posts/",
            json={"title": "Something vague", "budget": 100},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422

    def test_feed_target_business_sees_targeted_post_regardless_of_category(
        self, test_client, as_owner
    ):
        """The business the post targets gets an or_ filter that includes a
        `target_business_id.eq.<my-id>` branch — so a post targeted at it
        surfaces even when the post's category doesn't match its trade."""
        businesses_stub = SupabaseTableStub(
            select_data=[{"id": "biz-7", "category": "Handyman"}]
        )
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
        # Reaches me even off-category:
        assert "target_business_id.eq.biz-7" in filter_str

    def test_feed_targeted_post_does_not_leak_to_other_businesses(
        self, test_client, as_owner
    ):
        """The category branch of the feed filter is scoped to untargeted posts
        (`and(target_business_id.is.null,...)`), so a post targeted at some
        OTHER business can never appear via category matching."""
        businesses_stub = SupabaseTableStub(
            select_data=[{"id": "biz-7", "category": "Handyman"}]
        )
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
        # Category matches only ever apply to untargeted posts:
        assert "and(target_business_id.is.null,or(" in filter_str

    def test_feed_explicit_category_browse_excludes_targeted_posts(
        self, test_client, as_owner
    ):
        """A broad ?category= browse must never surface a post targeted at a
        specific business — the query is scoped with is_ null."""
        posts_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = posts_stub

            response = test_client.get(
                "/service-posts/?category=cleaning",
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        is_calls = [c for c in posts_stub.calls if c[0] == "is_"]
        assert ("target_business_id", "null") in [c[1] for c in is_calls]

    def test_feed_client_role_excludes_targeted_posts(self, test_client, as_client):
        """A client hitting the open feed sees only open marketplace posts,
        never someone else's direct booking."""
        posts_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = posts_stub

            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        is_calls = [c for c in posts_stub.calls if c[0] == "is_"]
        assert ("target_business_id", "null") in [c[1] for c in is_calls]


class TestTargetedPostAccessControl:
    """
    LANE C — feed filtering HIDES a targeted post from everyone but its target;
    these are the checks that ENFORCE it. Without them a business that learned a
    post id another way could read the job or quote on it anyway.
    """

    def test_non_target_business_cannot_read_targeted_post(self, test_client, as_owner):
        """GET /service-posts/{id} 404s for a business that isn't the target."""
        posts_stub = SupabaseTableStub(
            select_data={
                "id": "post-t1",
                "client_id": "client-1",
                "title": "Deep clean",
                "target_business_id": "biz-9",
            }
        )
        businesses_stub = SupabaseTableStub(select_data=[{"id": "biz-OTHER"}])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [posts_stub, businesses_stub]

            response = test_client.get(
                "/service-posts/post-t1",
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 404

    def test_target_business_can_read_targeted_post(self, test_client, as_owner):
        posts_stub = SupabaseTableStub(
            select_data={
                "id": "post-t1",
                "client_id": "client-1",
                "title": "Deep clean",
                "target_business_id": "biz-9",
            }
        )
        businesses_stub = SupabaseTableStub(select_data=[{"id": "biz-9"}])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [posts_stub, businesses_stub]

            response = test_client.get(
                "/service-posts/post-t1",
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        assert response.json()["id"] == "post-t1"

    def test_non_target_business_cannot_express_interest(self, test_client, as_owner):
        """POST /interests/ 404s when the post is targeted at someone else —
        the leak that feed filtering alone would not close."""
        businesses_stub = SupabaseTableStub(select_data={"id": "biz-OTHER"})
        posts_stub = SupabaseTableStub(
            select_data={
                "id": "post-t1",
                "status": "open",
                "target_business_id": "biz-9",
            }
        )

        with patch("app.api.interests.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [businesses_stub, posts_stub]

            response = test_client.post(
                "/interests/",
                json={"post_id": "post-t1", "quoted_price": 100},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 404

    def test_target_business_can_express_interest(self, test_client, as_owner):
        """The business the client picked quotes normally, even though the post
        is targeted."""
        businesses_stub = SupabaseTableStub(select_data={"id": "biz-9"})
        posts_stub = SupabaseTableStub(
            select_data={
                "id": "post-t1",
                "status": "open",
                "target_business_id": "biz-9",
            }
        )
        dup_stub = SupabaseTableStub(select_data=[])
        interests_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": "int-1",
                    "post_id": "post-t1",
                    "business_id": "biz-9",
                    "status": "pending",
                }
            ]
        )
        # Post-insert notification lookups are best-effort and wrapped in
        # try/except in the route; a stub that returns nothing is enough.
        noop_stub = SupabaseTableStub(select_data=None)

        with patch("app.api.interests.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [
                businesses_stub,
                posts_stub,
                dup_stub,
                interests_stub,
                noop_stub,
                noop_stub,
                noop_stub,
            ]

            response = test_client.post(
                "/interests/",
                json={"post_id": "post-t1", "quoted_price": 100},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code in [200, 201], response.text
        assert interests_stub.inserted["business_id"] == "biz-9"

    def test_untargeted_post_still_open_to_any_business(self, test_client, as_owner):
        """Regression guard: the new check must not touch ordinary open posts."""
        businesses_stub = SupabaseTableStub(select_data={"id": "biz-OTHER"})
        posts_stub = SupabaseTableStub(
            select_data={
                "id": "post-open",
                "status": "open",
                "target_business_id": None,
            }
        )
        dup_stub = SupabaseTableStub(select_data=[])
        interests_stub = SupabaseTableStub(insert_data=[{"id": "int-2"}])
        noop_stub = SupabaseTableStub(select_data=None)

        with patch("app.api.interests.supabase") as mock_supabase:
            mock_supabase.table.side_effect = [
                businesses_stub,
                posts_stub,
                dup_stub,
                interests_stub,
                noop_stub,
                noop_stub,
                noop_stub,
            ]

            response = test_client.post(
                "/interests/",
                json={"post_id": "post-open", "quoted_price": 100},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code in [200, 201], response.text


class TestUpdateServicePost:
    """
    PATCH /service-posts/{post_id} — GAP-AUDIT-2026-07-18 #3. Owner-only,
    open-status-only edit of title/description/budget/address/image_urls/
    preferred_date.
    """

    def test_non_client_role_rejected(self, test_client, as_owner):
        response = test_client.patch(
            "/service-posts/post-1",
            json={"title": "New title here"},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 403

    def test_non_owner_rejected(self, test_client, as_client):
        stub = SupabaseTableStub(
            select_data={"client_id": "someone-else", "status": "open"}
        )
        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/service-posts/post-1",
                json={"title": "New title here"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 403

    def test_post_not_found_returns_404(self, test_client, as_client):
        stub = SupabaseTableStub(select_data=None)
        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/service-posts/post-1",
                json={"title": "New title here"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 404

    def test_non_open_status_rejected(self, test_client, as_client):
        stub = SupabaseTableStub(
            select_data={"client_id": "client-1", "status": "matched"}
        )
        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/service-posts/post-1",
                json={"title": "New title here"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 400

    def test_no_fields_provided_rejected(self, test_client, as_client):
        stub = SupabaseTableStub(
            select_data={"client_id": "client-1", "status": "open"}
        )
        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/service-posts/post-1",
                json={},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 400

    def test_happy_path_updates_editable_fields(self, test_client, as_client):
        stub = SupabaseTableStub(
            select_data={"client_id": "client-1", "status": "open"},
            update_data=[
                {
                    "id": "post-1",
                    "title": "Updated title",
                    "budget": 250,
                    "preferred_date": "2026-08-01T10:00:00Z",
                    "status": "open",
                }
            ],
        )
        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/service-posts/post-1",
                json={
                    "title": "Updated title",
                    "budget": 250,
                    "preferred_date": "2026-08-01T10:00:00Z",
                },
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200, response.text
        update_calls = [c for c in stub.calls if c[0] == "update"]
        assert len(update_calls) == 1
        payload = update_calls[0][1][0]
        assert payload == {
            "title": "Updated title",
            "budget": 250,
            "preferred_date": "2026-08-01T10:00:00Z",
        }
        assert response.json()["post"]["title"] == "Updated title"

    def test_category_is_not_an_editable_field(self, test_client, as_client):
        """category is intentionally excluded from ServicePostUpdate — a
        category key in the body is silently ignored, not applied."""
        stub = SupabaseTableStub(
            select_data={"client_id": "client-1", "status": "open"},
            update_data=[{"id": "post-1", "title": "New title here"}],
        )
        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.patch(
                "/service-posts/post-1",
                json={"title": "New title here", "category": "plumbing"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200, response.text
        update_calls = [c for c in stub.calls if c[0] == "update"]
        assert "category" not in update_calls[0][1][0]


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

    def test_resolve_create_category_snaps_unknown_and_general_variants(self):
        # Canonical match still resolves normally.
        assert resolve_create_category("cleaning") == "Cleaning"
        # Off-taxonomy values snap to General instead of passing through.
        assert resolve_create_category("Reiki") == "General"
        assert resolve_create_category("Massage") == "General"
        # Explicit General, any casing, snaps cleanly too.
        assert resolve_create_category("general") == "General"
        assert resolve_create_category("GENERAL") == "General"
