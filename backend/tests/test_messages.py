"""
test_messages.py — Tests for /messages endpoints.

Coverage: DQ-4 — quote → booking thread continuity.

Root cause (see backend/app/api/messages.py::_quote_context_for_booking and
backend/app/api/interests.py::accept_interest):

- The message *history* was never actually lost. accept_interest() already
  re-parents every message on the winning interest thread onto the new
  booking by stamping `booking_id` on those rows (it does NOT clear
  `interest_id` — both columns end up set; the DB's messages_thread_check
  constraint is an OR, not XOR, so that's valid). GET /messages/{booking_id}
  filters on `.eq("booking_id", booking_id)`, so those carried-over rows come
  back as part of the booking thread's history — verified against live
  production data (10 of 11 recently-accepted interests with messages show
  the correct booking_id stamped on their pre-booking rows).
- What genuinely regressed: GET /messages/{booking_id}'s response never
  carried the quote *context* (job title / quoted price) the way
  GET /messages/interest/{id} does. ChatScreen only ever populates its
  header subtitle (`threadInfo`) from a `data.interest` key, so the instant
  the thread's routing flips from interestId to bookingId, that context
  block went blank even though the message bubbles above it were all still
  there — reading, to QA, like the whole conversation had been swapped out.
- Fix: get_messages() now looks up the accepted interest for the booking's
  post_id/business_id and returns it under the same `interest` key
  get_interest_messages() uses, so ChatScreen's existing (unmodified)
  `data?.interest` hookup renders the same context on both sides of the
  handshake. No mobile change required; no destructive DB change; message
  rows are never migrated or deleted here.
"""

from unittest.mock import patch

import pytest
from fastapi import BackgroundTasks

from app.api import messages as messages_mod
from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

CLIENT = {
    "id": "client-1",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Client",
    "email": "client@example.com",
}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


def _multi_table(stubs: dict, default: SupabaseTableStub):
    def _table(name):
        return stubs.get(name, default)

    return _table


class TestBookingThreadCarriesQuoteHistory:
    """GET /messages/{booking_id} must return quote-thread messages that
    accept_interest() carried over (booking_id stamped, interest_id kept)."""

    def test_messages_stamped_with_both_ids_are_returned_by_booking_query(
        self, test_client, as_client
    ):
        """
        DQ-4.1: a message row that still carries the original interest_id
        (never cleared — best-effort, non-destructive migration) but now also
        has booking_id set is retrievable via GET /messages/{booking_id},
        because the query filters on booking_id alone.
        """
        booking_stub = SupabaseTableStub(
            select_data={
                "id": "booking-1",
                "client_id": "client-1",
                "business_id": "biz-1",
                "post_id": None,
                "status": "confirmed",
            }
        )
        messages_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "msg-1",
                    "booking_id": "booking-1",
                    "interest_id": "interest-1",  # carried over, not cleared
                    "sender_id": "biz-owner-1",
                    "content": "Quoted $80 for the cleanup",
                    "sent_at": "2026-07-17T23:35:06Z",
                    "read_at": None,
                },
                {
                    "id": "msg-2",
                    "booking_id": "booking-1",
                    "interest_id": None,
                    "sender_id": "client-1",
                    "content": "Sounds good, see you then",
                    "sent_at": "2026-07-17T23:40:00Z",
                    "read_at": None,
                },
            ]
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "messages": messages_stub}, messages_stub
            )

            # booking_id path param must be a UUID (see _require_uuid); the
            # SupabaseTableStub ignores the value passed to .eq(), it just
            # returns whatever select_data was configured with above.
            response = test_client.get("/messages/22222222-2222-2222-2222-222222222222")

        assert response.status_code == 200, response.text
        data = response.json()
        contents = [m["content"] for m in data["items"]]
        assert "Quoted $80 for the cleanup" in contents
        assert "Sounds good, see you then" in contents

        select_eq_calls = [
            c for c in messages_stub.calls if c[0] == "eq" and c[1][0] == "booking_id"
        ]
        assert select_eq_calls, "expected the messages query to filter on booking_id"


class TestQuoteContextOnBookingThread:
    """GET /messages/{booking_id} surfaces the pre-booking quote context
    (job title + quoted price) under the same `interest` key
    GET /messages/interest/{id} uses, so ChatScreen's existing threadInfo
    rendering picks it up with no mobile change."""

    def test_returns_quote_context_for_post_matched_booking(
        self, test_client, as_client
    ):
        """DQ-4.2: booking created from an accepted interest — context present."""
        booking_stub = SupabaseTableStub(
            select_data={
                "id": "booking-1",
                "client_id": "client-1",
                "business_id": "biz-1",
                "post_id": "post-1",
                "status": "confirmed",
            }
        )
        messages_stub = SupabaseTableStub(select_data=[])
        interests_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "interest-1",
                    "status": "accepted",
                    "quoted_price": 80,
                    "service_posts": {"title": "Deep clean condo", "status": "matched"},
                }
            ]
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "messages": messages_stub,
                    "interests": interests_stub,
                },
                messages_stub,
            )

            response = test_client.get("/messages/33333333-3333-3333-3333-333333333333")

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["interest"] is not None
        assert data["interest"]["post_title"] == "Deep clean condo"
        assert data["interest"]["quoted_price"] == 80

    def test_no_quote_context_for_direct_geo_browse_booking(
        self, test_client, as_client
    ):
        """
        DQ-4.3: post_id is nullable on bookings (direct geo-browse flow has
        no post/interest at all) — must degrade to None, not error, and must
        not even attempt the interests lookup.
        """
        booking_stub = SupabaseTableStub(
            select_data={
                "id": "booking-2",
                "client_id": "client-1",
                "business_id": "biz-1",
                "post_id": None,
                "status": "confirmed",
            }
        )
        messages_stub = SupabaseTableStub(select_data=[])
        interests_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "messages": messages_stub,
                    "interests": interests_stub,
                },
                messages_stub,
            )

            response = test_client.get("/messages/44444444-4444-4444-4444-444444444444")

        assert response.status_code == 200, response.text
        assert response.json()["interest"] is None
        assert not interests_stub.calls, "must not query interests with no post_id"


class TestSendMessageCompletedBooking:
    """
    GAP-AUDIT-2026-07-18 #65: /messages/threads lists completed bookings as
    chattable threads (list_threads keeps status in (confirmed, in_progress,
    completed) — see messages.py:380), but POST /messages/ rejected anything
    outside (confirmed, in_progress), 400ing a thread the inbox itself shows
    as open. Product ruling: completed bookings stay sendable, not read-only.
    """

    def test_send_message_to_completed_booking_succeeds(self, test_client, as_client):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": "booking-1",
                "client_id": "client-1",
                "business_id": "biz-1",
                "status": "completed",
            }
        )
        businesses_stub = SupabaseTableStub(select_data={"owner_id": "owner-1"})
        messages_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": "msg-99",
                    "booking_id": "booking-1",
                    "sender_id": "client-1",
                    "content": "Thanks!",
                }
            ]
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                response = test_client.post(
                    "/messages/",
                    json={"booking_id": "booking-1", "content": "Thanks!"},
                    headers={"Authorization": "Bearer test-token"},
                )

        assert response.status_code == 200, response.text
        assert response.json()["data"]["content"] == "Thanks!"


def _booking_send_stubs(**message_kwargs):
    """bookings/businesses/messages stubs for a plain client → business send."""
    booking_stub = SupabaseTableStub(
        select_data={
            "id": "booking-1",
            "client_id": "client-1",
            "business_id": "biz-1",
            "status": "confirmed",
        }
    )
    businesses_stub = SupabaseTableStub(select_data={"owner_id": "owner-1"})
    messages_stub = SupabaseTableStub(**message_kwargs)
    return booking_stub, businesses_stub, messages_stub


class TestSendMessagePushIsBackgrounded:
    """
    #7c — send latency. send_push_to_user() POSTs to Expo serially per token
    with a 5s timeout (services/push.py), so calling it inline added up to
    ~10s to every POST /messages/. It must be handed to BackgroundTasks and
    never awaited on the request path.
    """

    def test_push_is_scheduled_not_called_inline(self, test_client, as_client):
        booking_stub, businesses_stub, messages_stub = _booking_send_stubs(
            insert_data=[
                {
                    "id": "msg-1",
                    "booking_id": "booking-1",
                    "sender_id": "client-1",
                    "content": "On my way",
                }
            ]
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user") as mock_push:
                with patch.object(BackgroundTasks, "add_task") as mock_add_task:
                    response = test_client.post(
                        "/messages/",
                        json={"booking_id": "booking-1", "content": "On my way"},
                    )

        assert response.status_code == 200, response.text
        # Scheduled once, with the push helper itself as the task callable.
        assert mock_add_task.call_count == 1
        task_args = mock_add_task.call_args[0]
        assert task_args[0] is mock_push
        assert task_args[1] == "owner-1"
        assert task_args[2] == "New message"
        # ...and never invoked on the request path (add_task is mocked out, so
        # any call here would have to be an inline one).
        mock_push.assert_not_called()

    def test_no_push_scheduled_when_sender_is_the_recipient(
        self, test_client, as_client
    ):
        """Self-send (client is also the business owner) schedules nothing."""
        booking_stub = SupabaseTableStub(
            select_data={
                "id": "booking-1",
                "client_id": "client-1",
                "business_id": "biz-1",
                "status": "confirmed",
            }
        )
        businesses_stub = SupabaseTableStub(select_data={"owner_id": "client-1"})
        messages_stub = SupabaseTableStub(insert_data=[{"id": "msg-1"}])

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                with patch.object(BackgroundTasks, "add_task") as mock_add_task:
                    response = test_client.post(
                        "/messages/",
                        json={"booking_id": "booking-1", "content": "note to self"},
                    )

        assert response.status_code == 200, response.text
        mock_add_task.assert_not_called()


class TestSendMessageRetryDedupe:
    """
    #7d — the mobile retry interceptor may re-issue POST /messages/ after a
    network error (Render cold start), including one where the row was already
    committed and only the response was lost. Retried requests carry
    X-Send-Retry; the server must return the already-stored message instead of
    posting a duplicate. A first-try send must not pay for that lookup.
    """

    def test_retry_returns_existing_message_without_reinserting(
        self, test_client, as_client
    ):
        existing = {
            "id": "msg-already-there",
            "booking_id": "booking-1",
            "sender_id": "client-1",
            "content": "On my way",
            "sent_at": "2026-07-22T10:00:00Z",
        }
        booking_stub, businesses_stub, messages_stub = _booking_send_stubs(
            select_data=[existing],
            insert_data=[{"id": "msg-duplicate", "content": "On my way"}],
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                response = test_client.post(
                    "/messages/",
                    json={"booking_id": "booking-1", "content": "On my way"},
                    headers={"X-Send-Retry": "1"},
                )

        assert response.status_code == 200, response.text
        assert response.json()["data"]["id"] == "msg-already-there"
        assert messages_stub.inserted is None, "retry must not write a second row"

    def test_retry_with_no_prior_row_still_inserts(self, test_client, as_client):
        booking_stub, businesses_stub, messages_stub = _booking_send_stubs(
            select_data=[],
            insert_data=[{"id": "msg-1", "content": "On my way"}],
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                response = test_client.post(
                    "/messages/",
                    json={"booking_id": "booking-1", "content": "On my way"},
                    headers={"X-Send-Retry": "2"},
                )

        assert response.status_code == 200, response.text
        assert response.json()["data"]["id"] == "msg-1"
        assert messages_stub.inserted is not None

    def test_first_try_send_skips_the_dedupe_lookup(self, test_client, as_client):
        booking_stub, businesses_stub, messages_stub = _booking_send_stubs(
            insert_data=[{"id": "msg-1", "content": "On my way"}],
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                response = test_client.post(
                    "/messages/",
                    json={"booking_id": "booking-1", "content": "On my way"},
                )

        assert response.status_code == 200, response.text
        # The dedupe query is the only thing on this path that windows on
        # sent_at — no .gte() means it never ran.
        assert not any(c[0] == "gte" for c in messages_stub.calls)


class TestMarkReadIsConditional:
    """
    #7 — the mobile chat polls the message list every 5s and _mark_read fired a
    DB WRITE on every one of those polls, even with nothing new to mark. The
    write must only happen when the fetched page actually contains an unread
    message from the other party.
    """

    BOOKING = {
        "id": "booking-1",
        "client_id": "client-1",
        "business_id": "biz-1",
        "post_id": None,
        "status": "confirmed",
    }

    def _get(self, test_client, items):
        booking_stub = SupabaseTableStub(select_data=dict(self.BOOKING))
        messages_stub = SupabaseTableStub(select_data=items)
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "messages": messages_stub}, messages_stub
            )
            response = test_client.get("/messages/55555555-5555-5555-5555-555555555555")
        return response, messages_stub

    def test_no_write_when_nothing_is_unread(self, test_client, as_client):
        response, messages_stub = self._get(
            test_client,
            [
                # already read
                {
                    "id": "m1",
                    "sender_id": "owner-1",
                    "content": "hi",
                    "sent_at": "2026-07-22T10:00:00Z",
                    "read_at": "2026-07-22T10:00:05Z",
                },
                # unread, but it's my own — reading my own message is a no-op
                {
                    "id": "m2",
                    "sender_id": "client-1",
                    "content": "hey",
                    "sent_at": "2026-07-22T10:01:00Z",
                    "read_at": None,
                },
            ],
        )
        assert response.status_code == 200, response.text
        assert not any(c[0] == "update" for c in messages_stub.calls)

    def test_write_happens_when_a_message_is_unread(self, test_client, as_client):
        response, messages_stub = self._get(
            test_client,
            [
                {
                    "id": "m1",
                    "sender_id": "owner-1",
                    "content": "hi",
                    "sent_at": "2026-07-22T10:00:00Z",
                    "read_at": None,
                }
            ],
        )
        assert response.status_code == 200, response.text
        assert any(c[0] == "update" for c in messages_stub.calls)


class TestBusinessIdOnQuoteThreads:
    """
    #9 — tap the chat header through to the business profile. Booking threads
    read business_id off the booking payload the screen already fetches; quote
    (interest) threads have no such payload, so the interest thread endpoint
    and the inbox row must carry business_id themselves.
    """

    def test_interest_thread_payload_includes_business_id(self, test_client, as_client):
        interests_stub = SupabaseTableStub(
            select_data={
                "id": "interest-1",
                "status": "accepted",
                "quoted_price": 120,
                "business_id": "biz-9",
                "service_posts": {
                    "id": "post-1",
                    "title": "Deep clean condo",
                    "status": "open",
                    "client_id": "client-1",
                },
            }
        )
        messages_stub = SupabaseTableStub(select_data=[])

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"interests": interests_stub, "messages": messages_stub}, messages_stub
            )
            response = test_client.get(
                "/messages/interest/66666666-6666-6666-6666-666666666666"
            )

        assert response.status_code == 200, response.text
        assert response.json()["interest"]["business_id"] == "biz-9"

    def test_thread_list_interest_row_includes_business_id(
        self, test_client, as_client
    ):
        bookings_stub = SupabaseTableStub(select_data=[])
        interests_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "interest-1",
                    "status": "pending",
                    "quoted_price": 120,
                    "business_id": "biz-9",
                    "service_posts": {
                        "id": "post-1",
                        "title": "Deep clean condo",
                        "status": "open",
                        "client_id": "client-1",
                    },
                    "businesses": {"business_name": "Test Cleaning Co."},
                }
            ]
        )
        messages_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "m1",
                    "booking_id": None,
                    "interest_id": "interest-1",
                    "sender_id": "owner-1",
                    "content": "Happy to help",
                    "sent_at": "2026-07-22T10:00:00Z",
                    "read_at": None,
                }
            ]
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": bookings_stub,
                    "interests": interests_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            response = test_client.get("/messages/threads")

        assert response.status_code == 200, response.text
        rows = response.json()["items"]
        assert len(rows) == 1
        assert rows[0]["thread_type"] == "interest"
        assert rows[0]["business_id"] == "biz-9"


class TestContactMaskingOnSend:
    """
    Item 31 — off-platform-leakage guard. A phone number or email in an
    outgoing message must be masked BEFORE the row is written, so the raw
    contact string never persists and can't be pulled back out via any read
    path. Prices/addresses must pass through untouched (false-positive safety
    is exhaustively covered in tests/test_contact_masking.py; this asserts the
    wiring in send_message actually stores the masked string).
    """

    def test_phone_is_masked_in_stored_row(self, test_client, as_client):
        booking_stub, businesses_stub, messages_stub = _booking_send_stubs(
            insert_data=[{"id": "msg-1", "content": "x"}]
        )
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                with patch.object(BackgroundTasks, "add_task"):
                    response = test_client.post(
                        "/messages/",
                        json={
                            "booking_id": "booking-1",
                            "content": "call me at 403-555-1234",
                        },
                    )
        assert response.status_code == 200, response.text
        assert response.json()["masked"] is True
        # The payload actually handed to .insert() must not contain the number.
        stored = messages_stub.inserted["content"]
        assert "403" not in stored
        assert "555" not in stored

    def test_price_is_not_masked(self, test_client, as_client):
        booking_stub, businesses_stub, messages_stub = _booking_send_stubs(
            insert_data=[{"id": "msg-1", "content": "x"}]
        )
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                with patch.object(BackgroundTasks, "add_task"):
                    response = test_client.post(
                        "/messages/",
                        json={
                            "booking_id": "booking-1",
                            "content": "The job is $250.00 total",
                        },
                    )
        assert response.status_code == 200, response.text
        assert response.json()["masked"] is False
        assert messages_stub.inserted["content"] == "The job is $250.00 total"


# ═══════════════════════════════════════════════════════════════════════════════
# M11 — photos and in-thread agreements
#
# Walkthrough item: "Share photos / agree to terms inside the message thread —
# the thread is currently text-only." Two shapes are covered below:
#
#   1. an image message (typed row + attachment columns, URL re-derived from
#      the stored storage path on read, retry identity keyed on that path);
#   2. a terms message — the one that has to hold up if somebody later says
#      "that is not what I agreed to". These tests are mostly about what CANNOT
#      happen: the client is the only party who can accept, nobody accepts their
#      own terms, an accepted record is never re-written, and altered wording
#      fails verification instead of quietly passing.
# ═══════════════════════════════════════════════════════════════════════════════

BUSINESS = {
    "id": "owner-1",
    "role": "business_owner",
    "first_name": "Test",
    "last_name": "Cleaning",
    "email": "biz@example.com",
}

INTEREST_ID = "44444444-4444-4444-4444-444444444444"
TERMS_ID = "55555555-5555-5555-5555-555555555555"


@pytest.fixture
def as_business():
    app.dependency_overrides[get_current_user] = lambda: BUSINESS
    yield BUSINESS
    app.dependency_overrides.pop(get_current_user, None)


def _interest_thread_stubs(viewer="business"):
    """interests + businesses stubs for a quote thread between client-1/biz-1.

    `viewer` picks the shape the businesses table has to answer with: the
    business side hits _my_business_id (a list), the client side hits the
    owner_id lookup that decides who gets the push (a single row).
    """
    interests_stub = SupabaseTableStub(
        select_data={
            "id": "interest-1",
            "business_id": "biz-1",
            "status": "pending",
            "quoted_price": 200,
            "service_posts": {
                "id": "post-1",
                "title": "Repaint the hallway",
                "status": "open",
                "client_id": "client-1",
            },
        }
    )
    businesses_stub = SupabaseTableStub(
        # _my_business_id does .limit(1) then reads [0]["id"] — list, not dict.
        select_data=(
            [{"id": "biz-1"}] if viewer == "business" else {"owner_id": "owner-1"}
        )
    )
    return interests_stub, businesses_stub


def _last_update_payload(stub):
    """The dict handed to the most recent .update(...) on a stub."""
    for name, args, _kwargs in reversed(stub.calls):
        if name == "update" and args:
            return args[0]
    raise AssertionError("no .update(...) was called on this stub")


class TestImageMessages:
    """A photo is a typed message row, not a URL pasted into chat text."""

    def test_image_send_stores_type_and_attachment_columns(
        self, test_client, as_client
    ):
        booking_stub, businesses_stub, messages_stub = _booking_send_stubs(
            insert_data=[
                {
                    "id": "msg-1",
                    "booking_id": "booking-1",
                    "sender_id": "client-1",
                    "content": "Photo",
                    "message_type": "image",
                    "attachment_url": "https://cdn.example/posts/client-1/a.jpg",
                    "attachment_path": "posts/client-1/a.jpg",
                }
            ]
        )
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            mock_supabase.storage.from_.return_value.get_public_url.return_value = (
                "https://cdn.example/posts/client-1/a.jpg"
            )
            with patch("app.api.messages.send_push_to_user"):
                with patch.object(BackgroundTasks, "add_task"):
                    response = test_client.post(
                        "/messages/",
                        json={
                            "booking_id": "booking-1",
                            "message_type": "image",
                            "attachment_url": "https://cdn.example/posts/client-1/a.jpg",
                            "attachment_path": "posts/client-1/a.jpg",
                            "attachment_width": 1200,
                            "attachment_height": 900,
                        },
                    )

        assert response.status_code == 200, response.text
        stored = messages_stub.inserted
        assert stored["message_type"] == "image"
        assert stored["attachment_path"] == "posts/client-1/a.jpg"
        assert stored["attachment_width"] == 1200
        # An uncaptioned photo still says what it is in the inbox preview.
        assert stored["content"] == "Photo"

    def test_image_send_without_an_attachment_is_rejected(self, test_client, as_client):
        """message_type=image with no file is a malformed row, not an empty chat."""
        response = test_client.post(
            "/messages/",
            json={"booking_id": "booking-1", "message_type": "image"},
        )
        assert response.status_code == 422, response.text

    def test_text_send_still_requires_content(self, test_client, as_client):
        """The old contract is untouched: a blank text message is still a 422."""
        response = test_client.post(
            "/messages/", json={"booking_id": "booking-1", "content": "   "}
        )
        assert response.status_code == 422, response.text

    def test_text_send_writes_no_attachment_columns(self, test_client, as_client):
        """99% path: a plain send stores exactly what it always stored."""
        booking_stub, businesses_stub, messages_stub = _booking_send_stubs(
            insert_data=[{"id": "msg-1", "content": "hello"}]
        )
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                with patch.object(BackgroundTasks, "add_task"):
                    response = test_client.post(
                        "/messages/",
                        json={"booking_id": "booking-1", "content": "hello"},
                    )
        assert response.status_code == 200, response.text
        assert set(messages_stub.inserted) == {"booking_id", "sender_id", "content"}

    def test_read_rederives_the_url_from_the_stored_path(self, test_client, as_client):
        """
        Reads never replay the URL frozen at write time — they re-derive it from
        attachment_path (same discipline uploads.sign_audio_path uses for the
        private voice-note bucket). That is what makes moving thread photos onto
        a private bucket a one-function change later.
        """
        booking_stub = SupabaseTableStub(
            select_data={
                "id": "booking-1",
                "client_id": "client-1",
                "business_id": "biz-1",
                "post_id": None,
                "status": "confirmed",
            }
        )
        messages_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "msg-1",
                    "sender_id": "client-1",
                    "content": "Photo",
                    "message_type": "image",
                    "attachment_url": "https://cdn.example/stale.jpg",
                    "attachment_path": "posts/client-1/a.jpg",
                    "sent_at": "2026-07-25T10:00:00Z",
                    "read_at": "2026-07-25T10:00:01Z",
                }
            ]
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {"bookings": booking_stub, "messages": messages_stub}, messages_stub
            )
            mock_supabase.storage.from_.return_value.get_public_url.return_value = (
                "https://cdn.example/fresh.jpg"
            )
            response = test_client.get("/messages/22222222-2222-2222-2222-222222222222")

        assert response.status_code == 200, response.text
        assert response.json()["items"][0]["attachment_url"] == (
            "https://cdn.example/fresh.jpg"
        )

    def test_storage_failure_falls_back_to_the_stored_url(self):
        """A storage hiccup must not blank out somebody's photo."""
        row = {
            "message_type": "image",
            "attachment_url": "https://cdn.example/stored.jpg",
            "attachment_path": "posts/client-1/a.jpg",
        }
        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.storage.from_.side_effect = RuntimeError("storage down")
            assert messages_mod._attachment_url(row) == (
                "https://cdn.example/stored.jpg"
            )


class TestProposeTerms:
    """Only the provider side proposes, and the proposal is fingerprinted."""

    def test_business_proposes_terms_on_a_quote_thread(self, test_client, as_business):
        interests_stub, businesses_stub = _interest_thread_stubs()
        messages_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": "msg-1",
                    "interest_id": "interest-1",
                    "sender_id": "owner-1",
                    "content": "Scope of work: Hallway repaint",
                    "message_type": "terms",
                }
            ]
        )
        terms_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": TERMS_ID,
                    "message_id": "msg-1",
                    "interest_id": "interest-1",
                    "proposed_by": "owner-1",
                    "title": "Hallway repaint",
                    "terms_text": "Two coats. We move the furniture. No drywall repair.",
                    "terms_hash": messages_mod._terms_fingerprint(
                        "msg-1",
                        "owner-1",
                        "Hallway repaint",
                        "Two coats. We move the furniture. No drywall repair.",
                    ),
                    "status": "pending",
                    "created_at": "2026-07-25T12:00:00Z",
                }
            ]
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "interests": interests_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                    "message_terms": terms_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                with patch.object(BackgroundTasks, "add_task"):
                    response = test_client.post(
                        "/messages/terms",
                        json={
                            "interest_id": INTEREST_ID,
                            "title": "Hallway repaint",
                            "terms_text": (
                                "Two coats. We move the furniture. "
                                "No drywall repair."
                            ),
                        },
                    )

        assert response.status_code == 200, response.text
        # The chat row is typed, and its preview line is what the inbox shows.
        assert messages_stub.inserted["message_type"] == "terms"
        assert messages_stub.inserted["content"].startswith("Scope of work:")
        # The agreement row carries the verbatim wording + its fingerprint.
        written = terms_stub.inserted
        assert written["status"] == "pending"
        assert written["terms_text"].startswith("Two coats.")
        assert written["terms_hash"] == messages_mod._terms_fingerprint(
            "msg-1", "owner-1", written["title"], written["terms_text"]
        )
        body = response.json()["data"]
        assert body["terms"]["verified"] is True
        # The proposer is not the party who can accept it.
        assert body["terms"]["can_accept"] is False

    def test_client_cannot_propose_terms_to_themselves(self, test_client, as_client):
        interests_stub, businesses_stub = _interest_thread_stubs("client")
        messages_stub = SupabaseTableStub()

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "interests": interests_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                },
                messages_stub,
            )
            response = test_client.post(
                "/messages/terms",
                json={
                    "interest_id": INTEREST_ID,
                    "title": "Anything",
                    "terms_text": "I agree with myself",
                },
            )

        assert response.status_code == 403, response.text
        assert messages_stub.inserted is None

    def test_contact_details_are_masked_before_the_fingerprint(
        self, test_client, as_business
    ):
        """
        'terms' must not become the one message type you can smuggle a phone
        number through — and the text that gets hashed has to be the text that
        gets stored, so masking runs BEFORE the fingerprint.
        """
        interests_stub, businesses_stub = _interest_thread_stubs()
        messages_stub = SupabaseTableStub(
            insert_data=[{"id": "msg-1", "message_type": "terms"}]
        )
        terms_stub = SupabaseTableStub(insert_data=[{"id": TERMS_ID}])

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "interests": interests_stub,
                    "businesses": businesses_stub,
                    "messages": messages_stub,
                    "message_terms": terms_stub,
                },
                messages_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                with patch.object(BackgroundTasks, "add_task"):
                    response = test_client.post(
                        "/messages/terms",
                        json={
                            "interest_id": INTEREST_ID,
                            "title": "Repaint",
                            "terms_text": "Call me on 403-555-1234 to arrange",
                        },
                    )

        assert response.status_code == 200, response.text
        written = terms_stub.inserted
        assert "403" not in written["terms_text"]
        assert written["terms_hash"] == messages_mod._terms_fingerprint(
            "msg-1", "owner-1", written["title"], written["terms_text"]
        )


class TestAcceptTerms:
    """The acceptance record: who, to what exact text, when — and write-once."""

    TITLE = "Hallway repaint"
    TEXT = "Two coats. We move the furniture. No drywall repair."

    def _terms_row(self, **overrides):
        row = {
            "id": TERMS_ID,
            "message_id": "msg-1",
            # A real thread key — the accept route re-resolves the thread off
            # this column, and _require_uuid rejects a non-UUID.
            "interest_id": INTEREST_ID,
            "booking_id": None,
            "proposed_by": "owner-1",
            "title": self.TITLE,
            "terms_text": self.TEXT,
            "terms_hash": messages_mod._terms_fingerprint(
                "msg-1", "owner-1", self.TITLE, self.TEXT
            ),
            "status": "pending",
            "created_at": "2026-07-25T12:00:00Z",
            "accepted_by": None,
            "accepted_at": None,
            "accepted_name": None,
            "acceptance_hash": None,
        }
        row.update(overrides)
        return row

    def test_client_acceptance_records_who_what_and_when(self, test_client, as_client):
        interests_stub, businesses_stub = _interest_thread_stubs("client")
        terms_stub = SupabaseTableStub(
            select_data=self._terms_row(),
            update_data=[self._terms_row(status="accepted")],
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "message_terms": terms_stub,
                    "interests": interests_stub,
                    "businesses": businesses_stub,
                },
                terms_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                with patch.object(BackgroundTasks, "add_task"):
                    response = test_client.post(f"/messages/terms/{TERMS_ID}/accept")

        assert response.status_code == 200, response.text
        written = _last_update_payload(terms_stub)
        assert written["status"] == "accepted"
        assert written["accepted_by"] == "client-1"
        assert written["accepted_at"]
        # The name as shown at the moment of acceptance, so a later profile
        # rename cannot restate who signed.
        assert written["accepted_name"] == "Jane Client"
        # The acceptance digest is chained to the terms digest.
        assert written["acceptance_hash"] == messages_mod._acceptance_fingerprint(
            self._terms_row()["terms_hash"], "client-1", written["accepted_at"]
        )

    def test_acceptance_update_is_conditional_on_still_being_pending(
        self, test_client, as_client
    ):
        """Two taps racing cannot both write an acceptance."""
        interests_stub, businesses_stub = _interest_thread_stubs("client")
        terms_stub = SupabaseTableStub(
            select_data=self._terms_row(),
            update_data=[self._terms_row(status="accepted")],
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "message_terms": terms_stub,
                    "interests": interests_stub,
                    "businesses": businesses_stub,
                },
                terms_stub,
            )
            with patch("app.api.messages.send_push_to_user"):
                with patch.object(BackgroundTasks, "add_task"):
                    test_client.post(f"/messages/terms/{TERMS_ID}/accept")

        guards = [
            c
            for c in terms_stub.calls
            if c[0] == "eq" and c[1] == ("status", "pending")
        ]
        assert guards, "the acceptance UPDATE must be guarded on status='pending'"

    def test_the_business_cannot_accept_its_own_terms(self, test_client, as_business):
        interests_stub, businesses_stub = _interest_thread_stubs()
        terms_stub = SupabaseTableStub(select_data=self._terms_row())

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "message_terms": terms_stub,
                    "interests": interests_stub,
                    "businesses": businesses_stub,
                },
                terms_stub,
            )
            response = test_client.post(f"/messages/terms/{TERMS_ID}/accept")

        assert response.status_code == 403, response.text
        assert not [c for c in terms_stub.calls if c[0] == "update"]

    def test_already_accepted_terms_cannot_be_accepted_again(
        self, test_client, as_client
    ):
        interests_stub, businesses_stub = _interest_thread_stubs("client")
        terms_stub = SupabaseTableStub(
            select_data=self._terms_row(
                status="accepted",
                accepted_by="client-1",
                accepted_at="2026-07-25T13:00:00Z",
                accepted_name="Jane Client",
                acceptance_hash="whatever",
            )
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "message_terms": terms_stub,
                    "interests": interests_stub,
                    "businesses": businesses_stub,
                },
                terms_stub,
            )
            response = test_client.post(f"/messages/terms/{TERMS_ID}/accept")

        assert response.status_code == 409, response.text
        assert not [c for c in terms_stub.calls if c[0] == "update"]

    def test_tampered_wording_cannot_be_accepted(self, test_client, as_client):
        """
        If the stored text and its fingerprint have drifted apart, the honest
        answer is "this can't be agreed to" — never "sign it anyway".
        """
        interests_stub, businesses_stub = _interest_thread_stubs("client")
        terms_stub = SupabaseTableStub(
            select_data=self._terms_row(
                terms_text="Two coats. We move the furniture. Drywall repair included."
            )
        )

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "message_terms": terms_stub,
                    "interests": interests_stub,
                    "businesses": businesses_stub,
                },
                terms_stub,
            )
            response = test_client.post(f"/messages/terms/{TERMS_ID}/accept")

        assert response.status_code == 409, response.text
        assert "verified" in response.json()["detail"]
        assert not [c for c in terms_stub.calls if c[0] == "update"]


class TestTermsVerificationOnRead:
    """`verified` is recomputed on every read, not trusted from storage."""

    TITLE = "Hallway repaint"
    TEXT = "Two coats. No drywall repair."

    def _accepted_row(self):
        terms_hash = messages_mod._terms_fingerprint(
            "msg-1", "owner-1", self.TITLE, self.TEXT
        )
        accepted_at = "2026-07-25T13:00:00Z"
        return {
            "id": TERMS_ID,
            "message_id": "msg-1",
            "proposed_by": "owner-1",
            "title": self.TITLE,
            "terms_text": self.TEXT,
            "terms_hash": terms_hash,
            "status": "accepted",
            "created_at": "2026-07-25T12:00:00Z",
            "accepted_by": "client-1",
            "accepted_at": accepted_at,
            "accepted_name": "Jane Client",
            "acceptance_hash": messages_mod._acceptance_fingerprint(
                terms_hash, "client-1", accepted_at
            ),
        }

    def test_intact_record_verifies(self):
        out = messages_mod._terms_public(self._accepted_row(), "client-1", "client-1")
        assert out["verified"] is True
        assert out["accepted_name"] == "Jane Client"

    def test_edited_wording_fails_verification(self):
        row = self._accepted_row()
        row["terms_text"] = self.TEXT + " Also we repair the drywall."
        assert messages_mod._terms_public(row, "client-1", "client-1")["verified"] is (
            False
        )

    def test_reassigned_acceptance_fails_verification(self):
        """Re-pointing an acceptance at a different person breaks the chain."""
        row = self._accepted_row()
        row["accepted_by"] = "someone-else"
        assert messages_mod._terms_public(row, "client-1", "client-1")["verified"] is (
            False
        )

    def test_backdated_acceptance_fails_verification(self):
        row = self._accepted_row()
        row["accepted_at"] = "2026-01-01T00:00:00Z"
        assert messages_mod._terms_public(row, "client-1", "client-1")["verified"] is (
            False
        )

    def test_thread_read_attaches_the_agreement_to_its_bubble(
        self, test_client, as_client
    ):
        booking_stub = SupabaseTableStub(
            select_data={
                "id": "booking-1",
                "client_id": "client-1",
                "business_id": "biz-1",
                "post_id": None,
                "status": "confirmed",
            }
        )
        messages_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "msg-1",
                    "sender_id": "owner-1",
                    "content": "Scope of work: Hallway repaint",
                    "message_type": "terms",
                    "sent_at": "2026-07-25T12:00:00Z",
                    "read_at": "2026-07-25T12:00:01Z",
                }
            ]
        )
        terms_stub = SupabaseTableStub(select_data=[self._accepted_row()])

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "messages": messages_stub,
                    "message_terms": terms_stub,
                },
                messages_stub,
            )
            response = test_client.get("/messages/22222222-2222-2222-2222-222222222222")

        assert response.status_code == 200, response.text
        item = response.json()["items"][0]
        assert item["terms"]["status"] == "accepted"
        assert item["terms"]["verified"] is True
        assert item["terms"]["terms_text"] == self.TEXT
        # Already accepted — nobody is offered the button again.
        assert item["terms"]["can_accept"] is False

    def test_a_terms_lookup_failure_does_not_break_the_thread(
        self, test_client, as_client
    ):
        """A message list must still render if the agreement lookup falls over."""
        booking_stub = SupabaseTableStub(
            select_data={
                "id": "booking-1",
                "client_id": "client-1",
                "business_id": "biz-1",
                "post_id": None,
                "status": "confirmed",
            }
        )
        messages_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "msg-1",
                    "sender_id": "owner-1",
                    "content": "Scope of work: Hallway repaint",
                    "message_type": "terms",
                    "sent_at": "2026-07-25T12:00:00Z",
                    "read_at": "2026-07-25T12:00:01Z",
                }
            ]
        )

        class _Exploding:
            def __getattr__(self, name):
                raise RuntimeError("message_terms unavailable")

        with patch("app.api.messages.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "messages": messages_stub,
                    "message_terms": _Exploding(),
                },
                messages_stub,
            )
            response = test_client.get("/messages/22222222-2222-2222-2222-222222222222")

        assert response.status_code == 200, response.text
        assert response.json()["items"][0]["content"].startswith("Scope of work:")
