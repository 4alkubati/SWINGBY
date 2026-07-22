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
