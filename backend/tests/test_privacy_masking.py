"""
test_privacy_masking.py — CARD-23: pre-acceptance client PII masking.

THE BUG (verified 2026-07-19): backend/app/api/service_posts.py::list_open_posts
ran `supabase.table("service_posts").select("*, users(first_name, last_name,
avatar_url)")` and returned rows unfiltered — every authenticated business
browsing the feed got the client's full street address and full legal name
before quoting, before acceptance, before any money moved. That contradicts
both the published privacy policy and the "INTERESTS as spam shield" design
decision in CLAUDE.md.

Every test class below pins one read path that returned service_posts/users
data to a non-owner. Each test was run against the pre-fix code (plain
`select("*", ...)` returned verbatim) and FAILED there — see the sibling
report at ~/brain/inbox/CARD-23-report.md for the git-stash verification
transcript. They pass now that app/privacy.py's masking is applied.

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


class TestFeedMasksPreAcceptance:
    def test_non_owner_business_gets_masked_address_and_no_last_name(
        self, test_client, as_owner
    ):
        posts_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "post-1",
                    "client_id": "client-1",
                    "title": "Need a plumber",
                    "address": FULL_ADDRESS,
                    "status": "open",
                    "users": {
                        "first_name": "Jane",
                        "last_name": "Client",
                        "avatar_url": None,
                    },
                }
            ]
        )
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
        assert item["address"] == MASKED_LOCALITY
        assert "last_name" not in item["users"] or item["users"]["last_name"] is None
        assert item["users"]["first_name"] == "Jane"

    def test_post_owner_sees_own_post_unmasked_in_feed(
        self, test_client, as_post_owner
    ):
        posts_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "post-1",
                    "client_id": "client-1",
                    "title": "Need a plumber",
                    "address": FULL_ADDRESS,
                    "status": "open",
                    "users": {
                        "first_name": "Jane",
                        "last_name": "Client",
                        "avatar_url": None,
                    },
                }
            ]
        )

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = posts_stub

            response = test_client.get(
                "/service-posts/", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        item = response.json()["items"][0]
        assert item["address"] == FULL_ADDRESS
        assert item["users"]["last_name"] == "Client"


# ── GET /service-posts/{post_id} (get_service_post) ─────────────────────────


class TestSinglePostMasksPreAcceptance:
    def test_non_owner_gets_masked_address_and_no_last_name(
        self, test_client, as_other_client
    ):
        stub = SupabaseTableStub(
            select_data={
                "id": "post-1",
                "client_id": "client-1",
                "title": "Need a plumber",
                "address": FULL_ADDRESS,
                "status": "open",
                "users": {
                    "first_name": "Jane",
                    "last_name": "Client",
                    "avatar_url": None,
                },
            }
        )

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get(
                "/service-posts/post-1", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        body = response.json()
        assert body["address"] == MASKED_LOCALITY
        assert not body["users"].get("last_name")

    def test_owner_sees_own_post_unmasked(self, test_client, as_post_owner):
        stub = SupabaseTableStub(
            select_data={
                "id": "post-1",
                "client_id": "client-1",
                "title": "Need a plumber",
                "address": FULL_ADDRESS,
                "status": "open",
                "users": {
                    "first_name": "Jane",
                    "last_name": "Client",
                    "avatar_url": None,
                },
            }
        )

        with patch("app.api.service_posts.supabase") as mock_supabase:
            mock_supabase.table.return_value = stub

            response = test_client.get(
                "/service-posts/post-1", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        body = response.json()
        assert body["address"] == FULL_ADDRESS
        assert body["users"]["last_name"] == "Client"

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
        assert not post["users"].get("last_name")

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
    def test_pending_quote_thread_shows_first_name_only(self, test_client, as_owner):
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(_threads_stubs("pending"))
            response = test_client.get(
                "/messages/threads", headers={"Authorization": "Bearer test-token"}
            )

        assert response.status_code == 200
        thread = response.json()["items"][0]
        assert thread["counterpart_name"] == "Jane"

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
    return {"interests": interest_stub, "businesses": biz_stub, "messages": messages_stub}


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
        assert not client_msg["users"].get("last_name")
        assert client_msg["users"]["first_name"] == "Jane"
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

    def test_mask_address_to_locality_passes_through_bare_locality(self):
        from app.privacy import mask_address_to_locality

        assert mask_address_to_locality("Calgary") == "Calgary"

    def test_mask_address_to_locality_handles_none_and_empty(self):
        from app.privacy import mask_address_to_locality

        assert mask_address_to_locality(None) is None
        assert mask_address_to_locality("") is None

    def test_mask_user_public_strips_last_name(self):
        from app.privacy import mask_user_public

        masked = mask_user_public(
            {"first_name": "Jane", "last_name": "Client", "avatar_url": "x.png"}
        )
        assert masked == {"first_name": "Jane", "avatar_url": "x.png"}

    def test_mask_user_public_handles_none(self):
        from app.privacy import mask_user_public

        assert mask_user_public(None) is None
