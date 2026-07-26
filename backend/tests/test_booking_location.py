"""
test_booking_location.py — WALKTHROUGH M7, live provider location.

These tests are about the PRIVACY BOUNDARY, not the plumbing. A live position is
the same class of data as the client home photos that were the walkthrough's
worst finding (L3), so the things asserted here are:

  * a third party gets nothing, ever;
  * a client can never WRITE a position (direction is provider -> client only);
  * the feed opens only on `en_route` and closes on arrived / started /
    completed / cancelled — and closing is enforced on the READ side too, so a
    provider app killed mid-drive still stops being visible;
  * closing also DELETES the stored row, so "stop" means gone, not hidden;
  * the response never carries a column the client is not meant to see;
  * a missing `booking_locations` table degrades to 200 + `available: false`
    instead of a 500 (the migration is filed, not applied).

Nothing here touches a real database.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import sqlparse
from fastapi import HTTPException

from app.api import booking_location as loc

REPO_ROOT = Path(__file__).parent.parent.parent
MIGRATION = (
    REPO_ROOT / "supabase" / "migrations" / "20260726130000_live_provider_location.sql"
)

BOOKING = {
    "id": "bk-1",
    "client_id": "client-1",
    "business_id": "biz-1",
    "employee_id": "emp-1",
    "status": "confirmed",
}

CLIENT = {"id": "client-1", "role": "client"}
OWNER = {"id": "owner-1", "role": "business_owner"}
EMPLOYEE = {"id": "emp-user-1", "role": "employee"}
STRANGER = {"id": "nosy-1", "role": "client"}

FIX = {"lat": 51.0447, "lng": -114.0719}


def _ev(*types):
    """booking_events rows as the API reads them: newest first."""
    return [
        {"event_type": t, "created_at": f"2026-07-26T12:0{i}:00Z"}
        for i, t in enumerate(types)
    ]


def _payload(**over):
    return loc.LocationIn(**{**FIX, **over})


# ── The sharing window (pure function — the whole privacy model) ──────────────


class TestWindow:
    def test_en_route_opens_it(self):
        assert loc.window_is_open(BOOKING, _ev("en_route")) is True

    def test_nothing_at_all_is_closed(self):
        """No lifecycle event = nobody has said they are on the way."""
        assert loc.window_is_open(BOOKING, []) is False

    @pytest.mark.parametrize(
        "closer", ["arrived", "started", "completed", "cancelled_event"]
    )
    def test_every_closer_shuts_it(self, closer):
        # newest-first: the closing event happened AFTER en_route.
        assert loc.window_is_open(BOOKING, _ev(closer, "en_route")) is False

    def test_terminal_booking_status_overrides_a_stale_en_route(self):
        """A booking cancelled through the cancellation flow may never write a
        `cancelled_event` row. It must still stop broadcasting."""
        for status in ("completed", "cancelled"):
            booking = {**BOOKING, "status": status}
            assert loc.window_is_open(booking, _ev("en_route")) is False

    def test_unrelated_events_do_not_close_it(self):
        """Proposing a new date mid-drive must not blank the client's map."""
        events = _ev("dates_proposed", "en_route")
        assert loc.window_is_open(BOOKING, events) is True

    def test_reopening_after_a_close_works(self):
        """Arrived at the wrong address, then back on the road."""
        assert (
            loc.window_is_open(BOOKING, _ev("en_route", "arrived", "en_route")) is True
        )


# ── Shaping: only whitelisted fields reach the client ────────────────────────


class TestPublicLocation:
    def test_internal_columns_are_never_echoed(self):
        row = {
            **FIX,
            "booking_id": "bk-1",
            "provider_id": "owner-1",
            "speed_mps": 14.2,
            "updated_at": "2026-07-26T12:00:00+00:00",
            "some_future_device_id": "pixel-8-serial",
        }
        out = loc.public_location(row)
        assert set(out) == {
            "lat",
            "lng",
            "accuracy_m",
            "heading",
            "updated_at",
            "age_seconds",
            "is_stale",
        }
        assert "provider_id" not in out
        assert "some_future_device_id" not in out

    def test_age_is_reported_honestly_and_old_fixes_are_flagged_stale(self):
        from datetime import datetime, timedelta, timezone

        fresh = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
        old = (datetime.now(timezone.utc) - timedelta(minutes=9)).isoformat()

        assert loc.public_location({**FIX, "updated_at": fresh})["is_stale"] is False
        stale = loc.public_location({**FIX, "updated_at": old})
        assert stale["is_stale"] is True
        assert stale["age_seconds"] >= 500

    def test_unparseable_timestamp_is_stale_not_a_crash(self):
        out = loc.public_location({**FIX, "updated_at": "whenever"})
        assert out["age_seconds"] is None
        assert out["is_stale"] is True

    def test_no_row_is_no_location(self):
        assert loc.public_location(None) is None


# ── Fixtures for the endpoints ───────────────────────────────────────────────


@pytest.fixture
def booking_loaded():
    with patch.object(loc, "_load_booking", return_value=BOOKING):
        yield


@pytest.fixture
def window_open():
    with patch.object(loc, "_is_sharing_open", return_value=True):
        yield


@pytest.fixture
def window_closed():
    with patch.object(loc, "_is_sharing_open", return_value=False):
        yield


def _as(user_is_client=False, user_is_provider=False):
    return (
        patch.object(loc, "_is_client", return_value=user_is_client),
        patch.object(loc, "_is_provider", return_value=user_is_provider),
    )


# ── Direction: only a provider may write ─────────────────────────────────────


class TestPushAuthorisation:
    def test_a_stranger_cannot_push(self, booking_loaded):
        a, b = _as()
        with a, b, patch.object(loc, "_write_row") as write:
            with pytest.raises(HTTPException) as exc:
                loc.push_location("bk-1", _payload(), current_user=STRANGER)
        assert exc.value.status_code == 403
        write.assert_not_called()

    def test_the_client_cannot_push_their_own_position(self, booking_loaded):
        """Location flows provider -> client. There is no reverse channel."""
        a, b = _as(user_is_client=True)
        with a, b, patch.object(loc, "_write_row") as write:
            with pytest.raises(HTTPException) as exc:
                loc.push_location("bk-1", _payload(), current_user=CLIENT)
        assert exc.value.status_code == 403
        write.assert_not_called()

    def test_the_provider_can_push_while_en_route(self, booking_loaded, window_open):
        a, b = _as(user_is_provider=True)
        with a, b, patch.object(
            loc,
            "_write_row",
            return_value={**FIX, "updated_at": "2026-07-26T12:00:00+00:00"},
        ) as write:
            out = loc.push_location("bk-1", _payload(), current_user=OWNER)
        assert out["sharing"] is True and out["stored"] is True
        assert write.call_args[0][1]["provider_id"] == "owner-1"
        assert out["location"]["lat"] == FIX["lat"]

    def test_the_assigned_employee_can_push_too(self, booking_loaded, window_open):
        a, b = _as(user_is_provider=True)
        with a, b, patch.object(loc, "_write_row", return_value={**FIX}):
            out = loc.push_location("bk-1", _payload(), current_user=EMPLOYEE)
        assert out["sharing"] is True


class TestPushWindow:
    def test_a_push_outside_the_window_is_refused_and_wipes_the_row(
        self, booking_loaded, window_closed
    ):
        """The straggler fix racing the Arrived tap is not an error — but it is
        also not stored, and it takes any surviving row with it."""
        a, b = _as(user_is_provider=True)
        with a, b, patch.object(loc, "_write_row") as write, patch.object(
            loc, "_delete_row"
        ) as delete:
            out = loc.push_location("bk-1", _payload(), current_user=OWNER)
        assert out["sharing"] is False
        assert out["location"] is None
        write.assert_not_called()
        delete.assert_called_once_with("bk-1")

    def test_coordinates_out_of_range_are_rejected_by_the_schema(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            loc.LocationIn(lat=91, lng=0)
        with pytest.raises(ValidationError):
            loc.LocationIn(lat=0, lng=181)


# ── Reads: who may see it ────────────────────────────────────────────────────


class TestReadAuthorisation:
    def test_a_third_party_gets_403_and_no_read_is_attempted(self, booking_loaded):
        a, b = _as()
        with a, b, patch.object(loc, "_read_row") as read:
            with pytest.raises(HTTPException) as exc:
                loc.get_location("bk-1", current_user=STRANGER)
        assert exc.value.status_code == 403
        read.assert_not_called()

    def test_the_client_on_the_booking_sees_the_dot(self, booking_loaded, window_open):
        a, b = _as(user_is_client=True)
        row = {
            **FIX,
            "provider_id": "owner-1",
            "updated_at": "2026-07-26T12:00:00+00:00",
        }
        with a, b, patch.object(loc, "_read_row", return_value=row):
            out = loc.get_location("bk-1", current_user=CLIENT)
        assert out["sharing"] is True
        assert out["location"]["lat"] == FIX["lat"]

    def test_the_provider_sees_their_own_fix_back(self, booking_loaded, window_open):
        """So the business app can honestly show "you are sharing"."""
        a, b = _as(user_is_provider=True)
        row = {
            **FIX,
            "provider_id": "owner-1",
            "updated_at": "2026-07-26T12:00:00+00:00",
        }
        with a, b, patch.object(loc, "_read_row", return_value=row):
            out = loc.get_location("bk-1", current_user=OWNER)
        assert out["sharing"] is True

    def test_a_colleague_who_is_not_driving_gets_no_coordinates(
        self, booking_loaded, window_open
    ):
        """The owner is a party to the booking, but the employee's live position
        is not owner-visible: the recipient of this feed is the client."""
        a, b = _as(user_is_provider=True)
        row = {
            **FIX,
            "provider_id": "someone-else",
            "updated_at": "2026-07-26T12:00:00+00:00",
        }
        with a, b, patch.object(loc, "_read_row", return_value=row):
            out = loc.get_location("bk-1", current_user=OWNER)
        assert out["sharing"] is False
        assert out["location"] is None
        assert out["reason"] == "not_shared_with_you"


class TestReadWindow:
    @pytest.mark.parametrize(
        "closer", ["arrived", "started", "completed", "cancelled_event"]
    )
    def test_the_client_sees_nothing_once_the_job_moves_on(self, closer):
        """Enforced on the READ, so a provider app killed mid-drive (and which
        therefore never sent a stop) still stops being visible."""
        events = _ev(closer, "en_route")
        a, b = _as(user_is_client=True)
        with patch.object(loc, "_load_booking", return_value=BOOKING), patch.object(
            loc, "_recent_events", return_value=events
        ), a, b, patch.object(
            loc, "_read_row", return_value={**FIX, "provider_id": "owner-1"}
        ) as read, patch.object(
            loc, "_delete_row"
        ) as delete:
            out = loc.get_location("bk-1", current_user=CLIENT)
        assert out["sharing"] is False
        assert out["location"] is None
        read.assert_not_called()
        # "Stopped" means the row is gone, not merely hidden behind a check.
        delete.assert_called_once_with("bk-1")

    def test_a_cancelled_booking_stops_broadcasting_even_with_a_live_en_route(self):
        a, b = _as(user_is_client=True)
        with patch.object(
            loc, "_load_booking", return_value={**BOOKING, "status": "cancelled"}
        ), patch.object(
            loc, "_recent_events", return_value=_ev("en_route")
        ), a, b, patch.object(
            loc, "_delete_row"
        ):
            out = loc.get_location("bk-1", current_user=CLIENT)
        assert out["sharing"] is False

    def test_open_window_but_no_fix_yet_is_honest_about_it(
        self, booking_loaded, window_open
    ):
        a, b = _as(user_is_client=True)
        with a, b, patch.object(loc, "_read_row", return_value=None):
            out = loc.get_location("bk-1", current_user=CLIENT)
        assert out["sharing"] is False
        assert out["reason"] == "no_fix_yet"

    def test_events_read_failure_fails_closed(self):
        """If we cannot prove they are en route, we do not move anyone's dot."""
        supa = MagicMock()
        supa.table.side_effect = RuntimeError("postgrest down")
        with patch.object(loc, "supabase", supa):
            assert loc._recent_events("bk-1") == []
        assert loc.window_is_open(BOOKING, []) is False


# ── Stop ─────────────────────────────────────────────────────────────────────


class TestStop:
    def test_the_provider_can_always_stop(self, booking_loaded, window_open):
        """ "Stop showing my position" is never refused because of other state."""
        a, b = _as(user_is_provider=True)
        with a, b, patch.object(loc, "_delete_row") as delete:
            out = loc.stop_sharing("bk-1", current_user=OWNER)
        assert out["sharing"] is False and out["stopped"] is True
        delete.assert_called_once_with("bk-1")

    def test_a_client_cannot_stop_the_providers_sharing(self, booking_loaded):
        a, b = _as(user_is_client=True)
        with a, b, patch.object(loc, "_delete_row") as delete:
            with pytest.raises(HTTPException) as exc:
                loc.stop_sharing("bk-1", current_user=CLIENT)
        assert exc.value.status_code == 403
        delete.assert_not_called()


# ── The table is not migrated yet ────────────────────────────────────────────


class TestDegradesWithoutTheTable:
    """20260726130000 is FILED, NOT APPLIED. Nothing may 500 in the meantime."""

    @pytest.fixture
    def no_table(self):
        supa = MagicMock()
        supa.table.side_effect = RuntimeError(
            'relation "public.booking_locations" does not exist'
        )
        with patch.object(loc, "supabase", supa):
            yield

    def test_read_returns_none_not_an_exception(self, no_table):
        assert loc._read_row("bk-1") is None

    def test_write_returns_none_not_an_exception(self, no_table):
        assert loc._write_row("bk-1", {"lat": 1, "lng": 2}) is None

    def test_delete_reports_failure_instead_of_raising(self, no_table):
        assert loc._delete_row("bk-1") is False

    def test_push_endpoint_answers_200_shaped(self, booking_loaded, window_open):
        a, b = _as(user_is_provider=True)
        with a, b, patch.object(loc, "_write_row", return_value=None):
            out = loc.push_location("bk-1", _payload(), current_user=OWNER)
        assert out["available"] is False
        assert out["stored"] is False
        # Still "sharing": the provider IS en route and the app should keep
        # trying — it is the storage that is missing, not the permission.
        assert out["sharing"] is True

    def test_get_endpoint_answers_200_shaped(self, booking_loaded, window_open):
        a, b = _as(user_is_client=True)
        with a, b, patch.object(loc, "_read_row", return_value=None):
            out = loc.get_location("bk-1", current_user=CLIENT)
        assert out["location"] is None
        assert out["sharing"] is False


# ── The migration itself ─────────────────────────────────────────────────────


class TestMigration:
    def test_it_parses(self):
        assert MIGRATION.exists()
        text = MIGRATION.read_text()
        assert sqlparse.parse(text)

    def test_one_row_per_booking_no_trail(self):
        """The no-history decision is a schema fact, not just a code habit."""
        text = MIGRATION.read_text().lower()
        assert "booking_id   uuid primary key" in text.replace("\t", " ")
        # No append-only sibling snuck in.
        assert "booking_location_history" not in text
        assert "create table if not exists public.booking_locations" in text

    def test_rls_is_on_and_writes_are_service_role_only(self):
        text = MIGRATION.read_text().lower()
        assert "enable row level security" in text
        assert "for select" in text
        # An authenticated INSERT/UPDATE/DELETE policy would let a leaked
        # frontend token author or tamper with a position row.
        assert "for insert" not in text
        assert "for update" not in text
        assert "for delete" not in text

    def test_it_is_marked_not_yet_applied(self):
        assert "FILED, PENDING APPLY" in MIGRATION.read_text()
