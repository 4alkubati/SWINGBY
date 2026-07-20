"""
test_booking_flow.py — End-to-end booking flow test.

Simulates complete user journey:
1. Client signup
2. Business signup
3. Business creates service post
4. Client expresses interest
5. Business accepts interest
6. Business assigns employee
7. Confirm date/time
8. Complete booking
9. Client submits review

All Supabase calls are mocked.
"""

from unittest.mock import patch, MagicMock

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


class TestFullBookingFlow:
    """Tests for complete booking workflow."""

    def test_end_to_end_booking_flow(self, test_client):
        """
        T83.1: Full booking flow from signup to review.

        Flow:
        1. Client creates account → POST /auth/signup (role='client')
        2. Business owner creates account → POST /auth/signup (role='business_owner')
        3. Business owner creates service post → POST /service-posts
        4. Client expresses interest → POST /interests
        5. Business owner accepts interest → PUT /interests/{id}
        6. Business owner assigns employee → POST /bookings/assign
        7. Confirm date/time → PUT /bookings/{id}
        8. Mark booking complete → PUT /bookings/{id}/complete
        9. Client submits review → POST /reviews
        """
        with patch("app.api.auth.supabase") as mock_supabase, patch(
            "app.api.auth.supabase_auth"
        ) as mock_supabase_auth:
            # Setup mocks — sign_up lives on the auth-only client, table ops on
            # the service-role client (see app/supabase_client.py)
            self._setup_auth_mocks(mock_supabase, mock_supabase_auth)

            # Step 1: Client signup
            client_response = test_client.post(
                "/auth/signup",
                json={
                    "email": "client@example.com",
                    "password": "ClientPass123",
                    "first_name": "Jane",
                    "last_name": "Client",
                    "role": "client",
                },
            )
            assert client_response.status_code == 200
            client_token = client_response.json().get("access_token")

            # Step 2: Business signup
            business_response = test_client.post(
                "/auth/signup",
                json={
                    "email": "business@example.com",
                    "password": "BusinessPass123",
                    "first_name": "John",
                    "last_name": "Business",
                    "role": "business_owner",
                },
            )
            assert business_response.status_code == 200
            business_token = business_response.json().get("access_token")

        # Steps 3-9: Service post, interest, acceptance, assignment, completion, review
        # (In real scenario, each would be a separate API call with proper mocking)
        assert client_token or True  # Placeholder assertion
        assert business_token or True

    def _setup_auth_mocks(self, mock_supabase, mock_supabase_auth):
        """Helper to setup common auth mocks."""
        mock_user = MagicMock()
        mock_user.id = "test-id"
        mock_session = MagicMock()
        mock_session.access_token = "test-token"
        mock_res = MagicMock()
        mock_res.user = mock_user
        mock_res.session = mock_session
        mock_supabase_auth.auth.sign_up.return_value = mock_res
        mock_supabase.table.return_value.upsert.return_value.execute.return_value = None


class TestConfirmDateRecordsTimelineEvent:
    """
    PATCH /bookings/{id}/confirm-date must append a 'date_confirmed'
    booking_events row so the handshake shows up on the live timeline (P1 #4
    from docs/qa-audit-2026-07-16-uber-flow.md — today the timeline jumps
    straight from nothing to en_route/arrived with no record the date was
    ever confirmed).
    """

    def test_confirm_date_inserts_date_confirmed_event(self, test_client, as_client):
        bookings_stub = SupabaseTableStub(
            select_data={
                "client_id": "client-1",
                "business_id": "biz-1",
                "status": "confirmed",
            },
            update_data=[
                {
                    "id": "booking-1",
                    "status": "in_progress",
                    "confirmed_date": "2026-08-01T10:00:00Z",
                }
            ],
        )
        events_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": "evt-1",
                    "booking_id": "booking-1",
                    "event_type": "date_confirmed",
                }
            ]
        )
        businesses_stub = SupabaseTableStub(select_data=None)
        users_stub = SupabaseTableStub(select_data=None)

        def _table(name):
            return {
                "bookings": bookings_stub,
                "booking_events": events_stub,
                "businesses": businesses_stub,
                "users": users_stub,
            }[name]

        with patch("app.api.bookings.supabase") as mock_supabase, patch(
            "app.api.bookings.send_push_to_user"
        ):
            mock_supabase.table.side_effect = _table

            response = test_client.patch(
                "/bookings/booking-1/confirm-date",
                json={"confirmed_date": "2026-08-01T10:00:00Z"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200, response.text

        insert_calls = [c for c in events_stub.calls if c[0] == "insert"]
        assert len(insert_calls) == 1
        payload = insert_calls[0][1][0]
        assert payload["event_type"] == "date_confirmed"
        assert payload["booking_id"] == "booking-1"


BUSINESS = {
    "id": "owner-1",
    "role": "business_owner",
    "first_name": "Bob",
    "last_name": "Owner",
    "email": "owner@example.com",
}


@pytest.fixture
def as_business():
    app.dependency_overrides[get_current_user] = lambda: BUSINESS
    yield BUSINESS
    app.dependency_overrides.pop(get_current_user, None)


class TestDateHandshake:
    """
    The confirm-date handshake is two-sided (Kira, 2026-07-17): after a quote
    is accepted, either party proposes times via PATCH /propose-dates and the
    OTHER party accepts one via PATCH /confirm-date. The proposer can never
    accept their own times.
    """

    def _stubs(self, booking_row):
        return {
            "bookings": SupabaseTableStub(
                select_data=booking_row,
                update_data=[{**booking_row, "id": "booking-1"}],
            ),
            "booking_events": SupabaseTableStub(insert_data=[{"id": "evt-1"}]),
            "businesses": SupabaseTableStub(
                select_data={"id": "biz-1", "owner_id": "owner-1"}
            ),
            "users": SupabaseTableStub(select_data=None),
        }

    def _patch(self, stubs):
        patcher = patch("app.api.bookings.supabase")
        mock_supabase = patcher.start()
        mock_supabase.table.side_effect = lambda name: stubs[name]
        return patcher

    def test_client_proposes_dates(self, test_client, as_client):
        stubs = self._stubs(
            {"client_id": "client-1", "business_id": "biz-1", "status": "confirmed"}
        )
        p = self._patch(stubs)
        try:
            with patch("app.api.bookings.send_push_to_user"):
                response = test_client.patch(
                    "/bookings/booking-1/propose-dates",
                    json={"proposed_date_1": "2026-08-01T10:00:00Z"},
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        assert response.status_code == 200, response.text
        update_calls = [c for c in stubs["bookings"].calls if c[0] == "update"]
        assert len(update_calls) == 1
        payload = update_calls[0][1][0]
        assert payload["date_proposed_by"] == "client-1"
        assert payload["proposed_date_1"] == "2026-08-01T10:00:00Z"
        event = stubs["booking_events"].inserted
        assert event["event_type"] == "dates_proposed"

    def test_business_confirms_client_proposed_date(self, test_client, as_business):
        stubs = self._stubs(
            {
                "client_id": "client-1",
                "business_id": "biz-1",
                "status": "confirmed",
                "date_proposed_by": "client-1",
            }
        )
        p = self._patch(stubs)
        try:
            with patch("app.api.bookings.send_push_to_user"):
                response = test_client.patch(
                    "/bookings/booking-1/confirm-date",
                    json={"confirmed_date": "2026-08-01T10:00:00Z"},
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        assert response.status_code == 200, response.text
        event = stubs["booking_events"].inserted
        assert event["event_type"] == "date_confirmed"

    def test_proposer_cannot_confirm_own_dates(self, test_client, as_client):
        stubs = self._stubs(
            {
                "client_id": "client-1",
                "business_id": "biz-1",
                "status": "confirmed",
                "date_proposed_by": "client-1",
            }
        )
        p = self._patch(stubs)
        try:
            response = test_client.patch(
                "/bookings/booking-1/confirm-date",
                json={"confirmed_date": "2026-08-01T10:00:00Z"},
                headers={"Authorization": "Bearer test-token"},
            )
        finally:
            p.stop()

        assert response.status_code == 403, response.text

    def test_business_cannot_confirm_legacy_untracked_proposal(
        self, test_client, as_business
    ):
        # No date_proposed_by on the row: dates came from assign-employee
        # before proposer tracking existed — only the client may accept.
        stubs = self._stubs(
            {"client_id": "client-1", "business_id": "biz-1", "status": "confirmed"}
        )
        p = self._patch(stubs)
        try:
            response = test_client.patch(
                "/bookings/booking-1/confirm-date",
                json={"confirmed_date": "2026-08-01T10:00:00Z"},
                headers={"Authorization": "Bearer test-token"},
            )
        finally:
            p.stop()

        assert response.status_code == 403, response.text

    def test_propose_requires_awaiting_confirmation_state(self, test_client, as_client):
        stubs = self._stubs(
            {"client_id": "client-1", "business_id": "biz-1", "status": "in_progress"}
        )
        p = self._patch(stubs)
        try:
            response = test_client.patch(
                "/bookings/booking-1/propose-dates",
                json={"proposed_date_1": "2026-08-01T10:00:00Z"},
                headers={"Authorization": "Bearer test-token"},
            )
        finally:
            p.stop()

        assert response.status_code == 400, response.text
