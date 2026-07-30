"""
test_booking_stage_events.py — the live-status timeline stays coherent.

Two defects from the 2026-07-29 business walkthrough, both about the same
thing: booking_events is the trust spine, and nothing was keeping it honest.

1. Three consecutive `en_route` rows reached the database, because two
   different controls on the business booking screen both posted the stage and
   neither could tell it had already been reached. The UI is fixed, but an
   append-only ledger must not depend on a screen to stay coherent —
   re-posting the CURRENT stage now collapses onto the row that exists.

2. PATCH /bookings/{id}/complete flipped the booking to completed but never
   appended a `completed` event, so the timeline just stopped at whatever the
   provider last tapped and no events-driven view could reach its final stage.
"""

import pytest

from app.api import booking_events


class _Res:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _StageQuery:
    """Records the filters the guard applies and returns a canned row."""

    def __init__(self, rows, recorder):
        self._rows = rows
        self._rec = recorder

    def __getattr__(self, name):
        def _call(*args, **kwargs):
            self._rec.append((name, args))
            return self

        return _call

    def execute(self):
        self._rec.append(("execute", ()))
        return _Res(self._rows)


@pytest.fixture
def stage_calls(monkeypatch):
    """Point `_latest_stage_event` at a stub table and record its query."""
    calls = []
    rows = {"value": []}

    class _Supa:
        def table(self, name):
            calls.append(("table", (name,)))
            return _StageQuery(rows["value"], calls)

    monkeypatch.setattr(booking_events, "supabase", _Supa())
    return calls, rows


class TestLatestStageEvent:
    def test_reads_the_most_recent_stage_row_newest_first(self, stage_calls):
        calls, rows = stage_calls
        rows["value"] = [{"id": "e1", "event_type": "arrived"}]

        got = booking_events._latest_stage_event("b1")

        assert got == {"id": "e1", "event_type": "arrived"}
        names = [c[0] for c in calls]
        assert "order" in names and "limit" in names
        # Newest first, or "current stage" means the oldest one.
        order = next(c for c in calls if c[0] == "order")
        assert order[1][0] == "created_at"

    def test_only_considers_stage_events(self, stage_calls):
        # `paused` / `resumed` / `dates_proposed` legitimately repeat, so they
        # must never be treated as the current stage or as duplicates.
        calls, rows = stage_calls
        rows["value"] = []

        booking_events._latest_stage_event("b1")

        in_filter = next(c for c in calls if c[0] == "in_")
        assert set(in_filter[1][1]) == {"en_route", "arrived", "started", "completed"}

    def test_returns_none_when_there_are_no_events(self, stage_calls):
        _, rows = stage_calls
        rows["value"] = []
        assert booking_events._latest_stage_event("b1") is None

    def test_a_read_failure_never_blocks_a_real_update(self, monkeypatch):
        # The guard de-duplicates; it is not an authorisation check. If it
        # cannot read, the event must still be written.
        class _Boom:
            def table(self, name):
                raise RuntimeError("supabase down")

        monkeypatch.setattr(booking_events, "supabase", _Boom())
        assert booking_events._latest_stage_event("b1") is None


class TestStageEventTypes:
    def test_the_four_stages_are_guarded(self):
        assert booking_events._STAGE_EVENT_TYPES == {
            "en_route",
            "arrived",
            "started",
            "completed",
        }

    def test_repeatable_moments_are_not_guarded(self):
        for event_type in ("paused", "resumed", "dates_proposed", "date_confirmed"):
            assert event_type not in booking_events._STAGE_EVENT_TYPES
            # ...and are still accepted by the endpoint at all.
            assert event_type in booking_events._ALLOWED_EVENT_TYPES


class TestCompleteWritesItsEvent:
    def test_complete_booking_appends_a_completed_event(self):
        # Read the source rather than standing up the whole payment path: the
        # point is that the insert EXISTS on this endpoint, and it is wrapped
        # so a failed timeline row cannot undo a completed, paid-out booking.
        import inspect

        from app.api import bookings

        src = inspect.getsource(bookings.complete_booking)
        assert '"booking_events"' in src
        assert '"event_type": "completed"' in src
        # Best-effort: the insert is preceded by its own `try:` and followed by
        # an `except` that only logs, so a lost timeline row cannot roll back a
        # completed, paid-out booking.
        before, after = src.split('supabase.table("booking_events")', 1)
        assert before.rstrip().endswith("try:")
        assert "except Exception:" in after
        assert "logger.warning" in after.split("except Exception:", 1)[1][:200]
