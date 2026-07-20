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
