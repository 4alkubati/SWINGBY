"""
test_card20_booking_entry.py — CARD-20 booking-entry flow (D2, decided 2026-07-19).

Kira's spec: a client's job post optionally carries `preferred_date`
(service_posts.preferred_date). When a business's quote on that post is
accepted:
  - preferred_date SET      -> the booking's confirmed_date is set immediately
                                 (no propose/accept handshake needed) and a
                                 date_confirmed booking_event is recorded.
  - preferred_date NOT set  -> unchanged pre-CARD-20 behavior: booking created
                                 without confirmed_date, the existing
                                 propose-dates/confirm-date handshake runs.
  - preferred_date column missing on this environment (migration not yet
    applied) -> accept must still succeed, degrading to the "not set" path
    instead of 500ing.
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


class TestAcceptInterestBookingEntry:
    def _base_stubs(self, post_row, booking_confirmed_date=None):
        booking_row = {
            "id": "booking-1",
            "client_id": "client-1",
            "business_id": "biz-1",
            "status": "confirmed",
        }
        if booking_confirmed_date:
            booking_row["confirmed_date"] = booking_confirmed_date

        return {
            "interests": SupabaseTableStub(
                select_data={
                    "id": "interest-1",
                    "post_id": "post-1",
                    "business_id": "biz-1",
                    "status": "pending",
                    "quoted_price": 150.0,
                },
                update_data=[{"id": "interest-1", "status": "accepted"}],
            ),
            "service_posts": SupabaseTableStub(
                select_data=post_row,
                update_data=[{**post_row, "status": "matched"}],
            ),
            "businesses": SupabaseTableStub(select_data=None),
            "bookings": SupabaseTableStub(insert_data=[booking_row]),
            "messages": SupabaseTableStub(update_data=[]),
            "payments": SupabaseTableStub(insert_data=[{"id": "pay-1"}]),
            "booking_events": SupabaseTableStub(insert_data=[{"id": "evt-1"}]),
            "users": SupabaseTableStub(select_data=None),
        }

    def _patch(self, stubs):
        patcher = patch("app.api.interests.supabase")
        mock_supabase = patcher.start()
        mock_supabase.table.side_effect = lambda name: stubs[name]
        return patcher

    def test_accept_with_preferred_date_confirms_booking_immediately(
        self, test_client, as_client
    ):
        post_row = {
            "id": "post-1",
            "client_id": "client-1",
            "budget": 150.0,
            "category": "Cleaning",
            "status": "open",
            "preferred_date": "2026-08-01T10:00:00Z",
        }
        stubs = self._base_stubs(post_row, booking_confirmed_date="2026-08-01T10:00:00Z")
        p = self._patch(stubs)
        try:
            with patch("app.api.interests.send_push_to_user"):
                response = test_client.patch(
                    "/interests/interest-1/accept",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        assert response.status_code == 200, response.text
        assert response.json()["booking"]["confirmed_date"] == "2026-08-01T10:00:00Z"

        insert_calls = [c for c in stubs["bookings"].calls if c[0] == "insert"]
        assert len(insert_calls) == 1
        assert insert_calls[0][1][0]["confirmed_date"] == "2026-08-01T10:00:00Z"

        event_calls = [c for c in stubs["booking_events"].calls if c[0] == "insert"]
        assert len(event_calls) == 1
        assert event_calls[0][1][0]["event_type"] == "date_confirmed"
        assert event_calls[0][1][0]["booking_id"] == "booking-1"

    def test_accept_without_preferred_date_leaves_handshake_open(
        self, test_client, as_client
    ):
        post_row = {
            "id": "post-1",
            "client_id": "client-1",
            "budget": 150.0,
            "category": "Cleaning",
            "status": "open",
            "preferred_date": None,
        }
        stubs = self._base_stubs(post_row)
        p = self._patch(stubs)
        try:
            with patch("app.api.interests.send_push_to_user"):
                response = test_client.patch(
                    "/interests/interest-1/accept",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        assert response.status_code == 200, response.text

        insert_calls = [c for c in stubs["bookings"].calls if c[0] == "insert"]
        assert "confirmed_date" not in insert_calls[0][1][0]

        event_calls = [c for c in stubs["booking_events"].calls if c[0] == "insert"]
        assert len(event_calls) == 0

    def test_accept_survives_preferred_date_column_missing(
        self, test_client, as_client
    ):
        """
        Migration guard: docs/service_posts_preferred_date.sql may not be
        applied on every environment yet. The isolated preferred_date probe
        must fail closed (accept still succeeds, pre-CARD-20 behavior) rather
        than 500ing the whole accept flow.
        """
        post_row = {
            "id": "post-1",
            "client_id": "client-1",
            "budget": 150.0,
            "category": "Cleaning",
            "status": "open",
        }
        stubs = self._base_stubs(post_row)

        class RaisingSelect:
            """Stands in for service_posts.select('preferred_date') on an
            environment where the column doesn't exist yet — any .execute()
            in the chain raises, like the real Supabase client would."""

            def __getattr__(self, name):
                if name == "execute":
                    def _execute():
                        raise Exception(
                            "column service_posts.preferred_date does not exist"
                        )
                    return _execute

                def _call(*_args, **_kwargs):
                    return self
                return _call

        real_posts_stub = stubs["service_posts"]
        raising = RaisingSelect()
        posts_calls = {"n": 0}

        def _table(name):
            if name == "service_posts":
                posts_calls["n"] += 1
                # 1st call = the primary post lookup, 3rd+ = the post ->
                # "matched" status update — both must keep working. Only the
                # 2nd call (the isolated preferred_date probe) blows up.
                return raising if posts_calls["n"] == 2 else real_posts_stub
            return stubs[name]

        patcher = patch("app.api.interests.supabase")
        mock_supabase = patcher.start()
        mock_supabase.table.side_effect = _table
        try:
            with patch("app.api.interests.send_push_to_user"):
                response = test_client.patch(
                    "/interests/interest-1/accept",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            patcher.stop()

        assert response.status_code == 200, response.text

        insert_calls = [c for c in stubs["bookings"].calls if c[0] == "insert"]
        assert len(insert_calls) == 1
        assert "confirmed_date" not in insert_calls[0][1][0]

        event_calls = [c for c in stubs["booking_events"].calls if c[0] == "insert"]
        assert len(event_calls) == 0
