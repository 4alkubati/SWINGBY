"""
test_privacy_masking.py — pre-acceptance client PII masking.

ROUND 1 (CARD-23, 2026-07-19): list_open_posts ran `select("*, users(...)")`
and returned rows verbatim, so every authenticated business browsing the feed
got the client's full street address and full legal name before quoting.
Masking was added — but masked TO first name + avatar.

ROUND 2 (walkthrough audit 2026-07-24, items L1/L2/L3/L4 + ruling S1): that
spec was itself the leak. A business could page the open feed and harvest, for
every client in the city and with no job and no verification: first name,
avatar, neighbourhood, budget, and photographs of the inside of the home.

    THE RULE NOW: until the client accepts (a booking exists), a business sees
    NOTHING identifying. A post renders as "Client" + locality + the job
    details + a photo COUNT. No name, no avatar, no client_id, no budget, no
    photo URLs, no exact coordinates. Everything unlocks on acceptance, for the
    winning business only, via the booking read path.

Every test class below pins one read path that returns service_posts/users
data to a non-owner.

Endpoints covered:
- GET /service-posts/          (list_open_posts)
- GET /service-posts/{post_id} (get_service_post)
- GET /interests/mine           (list_my_interests)
- GET /messages/threads         (list_threads, business/employee branch)
- GET /messages/interest/{id}   (get_interest_messages)
"""

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

CLIENT_OWNER = {
    "id": "client-1",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Client",
    "email": "jane@example.com",
}

OTHER_CLIENT = {
    "id": "client-2",
    "role": "client",
    "first_name": "Bob",
    "last_name": "Other",
    "email": "bob@example.com",
}

BUSINESS_OWNER = {
    "id": "owner-1",
    "role": "business_owner",
    "first_name": "Handy",
    "last_name": "Owner",
    "email": "handy@example.com",
}

FULL_ADDRESS = "123 Main St NW, Calgary, AB T2N 1N4"
MASKED_LOCALITY = "Calgary, AB T2N 1N4"


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _clear_override():
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_owner():
    _override(BUSINESS_OWNER)
    yield BUSINESS_OWNER
    _clear_override()


@pytest.fixture
def as_other_client():
    _override(OTHER_CLIENT)
    yield OTHER_CLIENT
    _clear_override()


@pytest.fixture
def as_post_owner():
    _override(CLIENT_OWNER)
    yield CLIENT_OWNER
    _clear_override()


def _multi_table(stubs: dict, default: SupabaseTableStub = None):
    def _table(name):
        return stubs.get(name, default)

    return _table


# ── GET /service-posts/ (list_open_posts) ───────────────────────────────────


def _feed_post(**overrides):
    """One service_posts row as the feed query now returns it.

    Note the users(...) embed: lifecycle flags ONLY. The feed no longer asks
    the database for a name or an avatar at all — see the select-shape test
    below, which is the regression guard for "don't fetch what you must not
    return".
    """
    row = {
        "id": "post-1",
        "client_id": "client-1",
        "title": "Need a plumber",
        "description": "Sink is leaking",
        "address": FULL_ADDRESS,
        "budget": 150,
        "lat": 51.128456,
        "lng": -114.098765,
        "image_urls": ["https://cdn/1.jpg", "https://cdn/2.jpg", "https://cdn/3.jpg"],
        "status": "open",
        "users": {"is_ghosted": False, "is_suspended": False, "deleted_at": None},
    }
    row.update(overrides)
    return row


class TestFeedMasksPreAcceptance:
    def test_business_sees_no_name_no_avatar_no_client_id(self, test_client, as_owner):
        posts_stub = SupabaseTableStub(select_data=[_feed_post()])
        businesses_stub = SupabaseTableStub(select_data=[])  # no biz row -> unfiltered

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"service_posts": posts_stub, "businesses": businesses_stub}
            )

            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        item = response.json()["items"][0]
        # Identity: nothing.
        assert item["users"]["first_name"] is None
        assert item["users"]["last_name"] is None
        assert item["users"]["avatar_url"] is None
        assert item["users"]["display_name"] == "Client"
        # L2 — the handle that made the client profile tappable.
        assert "client_id" not in item
        # Location: locality only, coarse coordinates.
        assert item["address"] == MASKED_LOCALITY
        assert item["lat"] == 51.13
        assert item["lng"] == -114.1
        # Nothing that could be reassembled into the raw row survived.
        assert "Jane" not in response.text
        assert "123 Main St" not in response.text

    def test_business_never_sees_the_budget(self, test_client, as_owner):
        """Ruling S1 — businesses bid their own rate; the client compares."""
        posts_stub = SupabaseTableStub(select_data=[_feed_post()])
        businesses_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"service_posts": posts_stub, "businesses": businesses_stub}
            )
            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

        item = response.json()["items"][0]
        assert "budget" not in item
        assert "150" not in response.text

    def test_job_photos_are_count_only(self, test_client, as_owner):
        """L3 — photos of the inside of a home never ride the pre-acceptance feed."""
        posts_stub = SupabaseTableStub(select_data=[_feed_post()])
        businesses_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"service_posts": posts_stub, "businesses": businesses_stub}
            )
            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

        item = response.json()["items"][0]
        assert item["image_urls"] == []
        assert item["photo_count"] == 3
        assert "cdn" not in response.text

    def test_feed_query_never_asks_for_name_or_avatar(self, test_client, as_owner):
        """Don't fetch what must not be returned (L1).

        The lifecycle filter still needs is_ghosted/is_suspended/deleted_at, so
        a users(...) embed survives — but it must project those three columns
        and nothing else.
        """
        posts_stub = SupabaseTableStub(select_data=[_feed_post()])
        businesses_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"service_posts": posts_stub, "businesses": businesses_stub}
            )
            test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

        select_args = [c for c in posts_stub.calls if c[0] == "select"]
        projection = select_args[0][1][0]
        assert "first_name" not in projection
        assert "last_name" not in projection
        assert "avatar_url" not in projection
        assert "is_ghosted" in projection

    def test_ghosted_poster_still_filtered_out(self, test_client, as_owner):
        posts_stub = SupabaseTableStub(
            select_data=[
                _feed_post(
                    users={
                        "is_ghosted": True,
                        "is_suspended": False,
                        "deleted_at": None,
                    }
                )
            ]
        )
        businesses_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"service_posts": posts_stub, "businesses": businesses_stub}
            )
            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

        assert response.json()["items"] == []

    def test_post_owner_sees_own_post_unmasked_in_feed(
        self, test_client, as_post_owner
    ):
        posts_stub = SupabaseTableStub(select_data=[_feed_post()])

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = posts_stub

            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        item = response.json()["items"][0]
        assert item["address"] == FULL_ADDRESS
        assert item["budget"] == 150
        assert item["image_urls"] == [
            "https://cdn/1.jpg",
            "https://cdn/2.jpg",
            "https://cdn/3.jpg",
        ]
        assert item["lat"] == 51.128456
        # The lifecycle join is internal plumbing, not part of the contract.
        assert "users" not in item


# ── GET /service-posts/{post_id} (get_service_post) ─────────────────────────


class TestSinglePostMasksPreAcceptance:
    def test_non_owner_gets_anonymous_view(self, test_client, as_other_client):
        stub = SupabaseTableStub(select_data=_feed_post())

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get(
                "/service-posts/post-1", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        body = response.json()
        assert body["address"] == MASKED_LOCALITY
        assert body["users"]["display_name"] == "Client"
        assert body["users"]["first_name"] is None
        assert "client_id" not in body
        assert "budget" not in body
        assert body["image_urls"] == []
        assert body["photo_count"] == 3

    def test_single_post_query_never_joins_users(self, test_client, as_other_client):
        stub = SupabaseTableStub(select_data=_feed_post())
        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub
            test_client.get(
                "/service-posts/post-1", headers={"Authorization": "Bearer test-token"}
            )
        projection = [c for c in stub.calls if c[0] == "select"][0][1][0]
        assert projection == "*"

    def test_owner_sees_own_post_unmasked(self, test_client, as_post_owner):
        stub = SupabaseTableStub(select_data=_feed_post())

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get(
                "/service-posts/post-1", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        body = response.json()
        assert body["address"] == FULL_ADDRESS
        assert body["budget"] == 150
        assert body["client_id"] == "client-1"

    def test_missing_post_returns_404_not_500(self, test_client, as_other_client):
        stub = SupabaseTableStub(select_data=None)
        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub
            response = test_client.get(
                "/service-posts/nope", headers={"Authorization": "Bearer test-token"}
            )
        assert response.status_code == 404


# ── GET /interests/mine (list_my_interests) ──────────────────────────────────


class TestMyInterestsMasksPendingQuotes:
    def test_pending_interest_masks_address_and_last_name(self, test_client, as_owner):
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        interests_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "int-1",
                    "status": "pending",
                    "quoted_price": 100,
                    "service_posts": {
                        "id": "post-1",
                        "title": "Fix sink",
                        "category": "Plumbing",
                        "status": "open",
                        "address": FULL_ADDRESS,
                        "users": {
                            "first_name": "Jane",
                            "last_name": "Client",
                            "avatar_url": None,
                        },
                    },
                }
            ]
        )

        with patch("app.api.interests.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"businesses": biz_stub, "interests": interests_stub}
            )
            response = test_client.get(
                "/interests/mine", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        post = response.json()["items"][0]["service_posts"]
        assert post["address"] == MASKED_LOCALITY
        assert post["users"]["first_name"] is None
        assert post["users"]["last_name"] is None
        assert post["users"]["display_name"] == "Client"

    def test_accepted_interest_keeps_full_address_and_last_name(
        self, test_client, as_owner
    ):
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        interests_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "int-2",
                    "status": "accepted",
                    "quoted_price": 100,
                    "service_posts": {
                        "id": "post-2",
                        "title": "Fix sink",
                        "category": "Plumbing",
                        "status": "matched",
                        "address": FULL_ADDRESS,
                        "users": {
                            "first_name": "Jane",
                            "last_name": "Client",
                            "avatar_url": None,
                        },
                    },
                }
            ]
        )

        with patch("app.api.interests.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"businesses": biz_stub, "interests": interests_stub}
            )
            response = test_client.get(
                "/interests/mine", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        post = response.json()["items"][0]["service_posts"]
        assert post["address"] == FULL_ADDRESS
        assert post["users"]["last_name"] == "Client"


# ── GET /messages/threads (list_threads, business/employee branch) ─────────


def _threads_stubs(interest_status: str):
    biz_stub = SupabaseTableStub(select_data=[{"id": "biz-1"}])
    bookings_stub = SupabaseTableStub(select_data=[])
    interests_stub = SupabaseTableStub(
        select_data=[
            {
                "id": "int-1",
                "status": interest_status,
                "quoted_price": 100,
                "business_id": "biz-1",
                "service_posts": {
                    "id": "post-1",
                    "title": "Fix sink",
                    "status": "open",
                    "client_id": "client-1",
                    "users": {
                        "first_name": "Jane",
                        "last_name": "Client",
                        "avatar_url": None,
                    },
                },
            }
        ]
    )
    messages_stub = SupabaseTableStub(
        select_data=[
            {
                "id": "m1",
                "booking_id": None,
                "interest_id": "int-1",
                "sender_id": "client-1",
                "content": "Hi, when can you come?",
                "sent_at": "2026-07-18T10:00:00Z",
                "read_at": None,
            }
        ]
    )
    return {
        "businesses": biz_stub,
        "bookings": bookings_stub,
        "interests": interests_stub,
        "messages": messages_stub,
    }


class TestMessageThreadsMasksPendingCounterpart:
    def test_pending_quote_thread_shows_anonymous_counterpart(
        self, test_client, as_owner
    ):
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(_threads_stubs("pending"))
            response = test_client.get(
                "/messages/threads", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        thread = response.json()["items"][0]
        assert thread["counterpart_name"] == "Client"
        assert thread["counterpart_avatar"] is None
        assert "Jane" not in response.text

    def test_accepted_quote_thread_shows_full_name(self, test_client, as_owner):
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(_threads_stubs("accepted"))
            response = test_client.get(
                "/messages/threads", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        thread = response.json()["items"][0]
        assert thread["counterpart_name"] == "Jane Client"


# ── GET /messages/interest/{interest_id} (get_interest_messages) ────────────


INTEREST_UUID = "11111111-1111-1111-1111-111111111111"


def _interest_messages_stubs(interest_status: str):
    interest_stub = SupabaseTableStub(
        select_data={
            "id": INTEREST_UUID,
            "status": interest_status,
            "business_id": "biz-1",
            "quoted_price": 100,
            "service_posts": {
                "id": "post-1",
                "title": "Fix sink",
                "status": "open",
                "client_id": "client-1",
            },
        }
    )
    biz_stub = SupabaseTableStub(select_data=[{"id": "biz-1"}])
    messages_stub = SupabaseTableStub(
        select_data=[
            {
                "id": "m1",
                "sender_id": "client-1",
                "content": "Hi, when can you come?",
                "sent_at": "2026-07-18T10:00:00Z",
                "read_at": None,
                "users": {"first_name": "Jane", "last_name": "Client"},
            },
            {
                "id": "m2",
                "sender_id": "owner-1",
                "content": "Tomorrow morning works",
                "sent_at": "2026-07-18T10:05:00Z",
                "read_at": None,
                "users": {"first_name": "Handy", "last_name": "Owner"},
            },
        ]
    )
    return {
        "interests": interest_stub,
        "businesses": biz_stub,
        "messages": messages_stub,
    }


class TestInterestMessagesMasksClientSenderPreAcceptance:
    def test_pending_thread_masks_only_the_clients_own_messages(
        self, test_client, as_owner
    ):
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                _interest_messages_stubs("pending")
            )
            response = test_client.get(
                f"/messages/interest/{INTEREST_UUID}",
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        items = response.json()["items"]
        client_msg = next(m for m in items if m["sender_id"] == "client-1")
        business_msg = next(m for m in items if m["sender_id"] == "owner-1")
        assert client_msg["users"]["first_name"] is None
        assert client_msg["users"]["last_name"] is None
        assert client_msg["users"]["display_name"] == "Client"
        # The business owner's own name is not client PII — untouched.
        assert business_msg["users"]["last_name"] == "Owner"

    def test_accepted_thread_keeps_clients_last_name(self, test_client, as_owner):
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                _interest_messages_stubs("accepted")
            )
            response = test_client.get(
                f"/messages/interest/{INTEREST_UUID}",
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200
        items = response.json()["items"]
        client_msg = next(m for m in items if m["sender_id"] == "client-1")
        assert client_msg["users"]["last_name"] == "Client"


# ── app.privacy unit tests ───────────────────────────────────────────────────


class TestPrivacyHelpersUnit:
    def test_mask_address_to_locality_strips_street_portion(self):
        from app.privacy import mask_address_to_locality

        assert mask_address_to_locality(FULL_ADDRESS) == MASKED_LOCALITY

    def test_mask_address_to_locality_hides_bare_street_number_with_no_comma(self):
        from app.privacy import mask_address_to_locality

        assert mask_address_to_locality("123 Main St NW") is None

    def test_mask_address_to_locality_fails_closed_on_comma_less_free_text(self):
        """L4 — the exact string from the audit.

        Google autocomplete supplies the comma; a free-typed address does not.
        The old rule ("doesn't start with a digit → it must be a locality")
        published this verbatim to every business in the city.
        """
        from app.privacy import mask_address_to_locality

        assert mask_address_to_locality("Citadel Meadow Gardens NW") is None

    def test_mask_address_to_locality_fails_closed_on_bare_city_too(self):
        """A bare city name is indistinguishable by shape from the above, so it
        is hidden as well. Fail closed is the whole point: a client who wants a
        neighbourhood shown picks a structured place, which carries the comma."""
        from app.privacy import mask_address_to_locality

        assert mask_address_to_locality("Calgary") is None
        assert mask_address_to_locality("Calgary, AB") == "AB"

    def test_mask_address_to_locality_handles_none_and_empty(self):
        from app.privacy import mask_address_to_locality

        assert mask_address_to_locality(None) is None
        assert mask_address_to_locality("") is None

    def test_mask_user_public_returns_no_identity_at_all(self):
        from app.privacy import mask_user_public

        masked = mask_user_public(
            {"first_name": "Jane", "last_name": "Client", "avatar_url": "x.png"}
        )
        assert masked == {
            "display_name": "Client",
            "first_name": None,
            "last_name": None,
            "avatar_url": None,
        }

    def test_mask_user_public_handles_none(self):
        from app.privacy import mask_user_public

        assert mask_user_public(None) is None

    def test_mask_service_post_row_does_not_mutate_input(self):
        from app.privacy import mask_service_post_row

        original = {
            "client_id": "client-1",
            "budget": 150,
            "address": FULL_ADDRESS,
            "image_urls": ["a.jpg"],
        }
        snapshot = dict(original)
        mask_service_post_row(original)
        assert original == snapshot

    def test_mask_service_post_row_on_narrow_projection(self):
        """Safe on the messages-inbox embed, which has no address/budget/photos."""
        from app.privacy import mask_service_post_row

        masked = mask_service_post_row({"id": "post-1", "title": "Fix sink"})
        assert masked["title"] == "Fix sink"
        assert masked["users"]["display_name"] == "Client"
        assert "photo_count" not in masked

    def test_coordinates_are_coarsened_not_exact(self):
        from app.privacy import mask_service_post_row

        masked = mask_service_post_row({"lat": 51.128456, "lng": -114.098765})
        assert masked["lat"] == 51.13
        assert masked["lng"] == -114.1

    def test_photo_count_survives_a_missing_or_null_list(self):
        from app.privacy import mask_service_post_row

        assert mask_service_post_row({"image_urls": None})["photo_count"] == 0
        assert "photo_count" not in mask_service_post_row({"id": "x"})
