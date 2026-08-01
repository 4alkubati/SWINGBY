"""
test_approvals.py — who releases the client's money, and when.

The bug this guards against shipped and was caught on a real device: the
business marked its own job complete and the escrow went straight to it, while
the pay sheet told the client "released only when you approve the work".

So the tests worth having are the ones that fail if that comes back:
  * marking work done must move NO money
  * only the client may approve
  * the 24h window must actually expire, and must do it without a scheduler
  * nothing may release twice
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services import approvals, escrow


def _dt(offset_hours: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=offset_hours)).isoformat()


class TestIsDue:
    def test_not_due_before_the_window_closes(self):
        assert not approvals.is_due(
            {"id": "b", "payment_status": "held", "approval_deadline_at": _dt(+1)}
        )

    def test_due_once_the_window_has_closed(self):
        assert approvals.is_due(
            {"id": "b", "payment_status": "held", "approval_deadline_at": _dt(-1)}
        )

    def test_not_due_when_there_is_no_window(self):
        assert not approvals.is_due(
            {"id": "b", "payment_status": "held", "approval_deadline_at": None}
        )

    def test_not_due_once_already_released(self):
        # The deadline column is cleared on release, but belt and braces: a
        # stale deadline on a released booking must never re-release.
        assert not approvals.is_due(
            {
                "id": "b",
                "payment_status": "fully_released",
                "approval_deadline_at": _dt(-99),
            }
        )

    def test_garbage_deadline_is_not_due(self):
        assert not approvals.is_due(
            {"id": "b", "payment_status": "held", "approval_deadline_at": "not a date"}
        )

    def test_naive_timestamp_is_treated_as_utc(self):
        naive = (datetime.now(timezone.utc) - timedelta(hours=2)).replace(tzinfo=None)
        assert approvals.is_due(
            {
                "id": "b",
                "payment_status": "held",
                "approval_deadline_at": naive.isoformat(),
            }
        )


class TestStartApprovalWindow:
    def test_marking_work_done_moves_no_money(self):
        """The whole point. `complete` must not touch the ledger."""
        sb = MagicMock()
        with patch.object(approvals, "supabase", sb), patch.object(
            approvals, "needs_approval_window", return_value=True
        ), patch.object(approvals.escrow, "release_escrow_on_complete") as release:
            approvals.start_approval_window("bk-1", "owner-1")

        release.assert_not_called()

    def test_window_is_24_hours_and_payment_stays_held(self):
        sb = MagicMock()
        with patch.object(approvals, "supabase", sb), patch.object(
            approvals, "needs_approval_window", return_value=True
        ):
            deadline = approvals.start_approval_window("bk-1", "owner-1")

        payload = sb.table.return_value.update.call_args_list[0].args[0]
        assert payload["status"] == "completed"
        assert payload["payment_status"] == "held"
        parsed = datetime.fromisoformat(deadline)
        delta = parsed - datetime.now(timezone.utc)
        assert timedelta(hours=23) < delta <= timedelta(hours=24)

    def test_cash_job_completes_with_no_window(self):
        """A booking that was never held in escrow gets no countdown — a 24h
        timer over money that will never move is just a confusing badge."""
        sb = MagicMock()
        with patch.object(approvals, "supabase", sb), patch.object(
            approvals, "needs_approval_window", return_value=False
        ):
            assert approvals.start_approval_window("bk-1", "owner-1") is None

        payload = sb.table.return_value.update.call_args_list[0].args[0]
        assert payload == {"status": "completed"}


class TestRelease:
    def test_release_clears_the_window_and_marks_released(self):
        sb = MagicMock()
        with patch.object(approvals, "supabase", sb), patch.object(
            approvals.escrow,
            "release_escrow_on_complete",
            return_value={"outcome": "released"},
        ):
            approvals.release("bk-1", actor_id="client-1", reason="client_approved")

        payload = sb.table.return_value.update.call_args_list[0].args[0]
        assert payload["payment_status"] == "fully_released"
        assert payload["approval_deadline_at"] is None

    def test_a_failed_release_leaves_the_window_open(self):
        """If the ledger move throws, the booking must NOT be marked released —
        otherwise the money is stuck and the record says it was paid out."""
        sb = MagicMock()
        with patch.object(approvals, "supabase", sb), patch.object(
            approvals.escrow,
            "release_escrow_on_complete",
            side_effect=escrow.EscrowError("boom"),
        ):
            with pytest.raises(escrow.EscrowError):
                approvals.release("bk-1", actor_id=None, reason="auto_released")

        sb.table.return_value.update.assert_not_called()


class TestSettleIfDue:
    def test_expired_window_releases_without_a_scheduler(self):
        """The 24h rule has to fire on a read, because nothing schedules it.

        `expiry_sweep.sweep_once` has existed for weeks and is called by nothing
        but its own tests — there is no cron service and no worker — so a timer
        would never run and the money would sit held forever.
        """
        booking = {
            "id": "bk-1",
            "payment_status": "held",
            "approval_deadline_at": _dt(-2),
        }
        with patch.object(approvals, "supabase", MagicMock()), patch.object(
            approvals.escrow,
            "release_escrow_on_complete",
            return_value={"outcome": "released"},
        ) as release:
            assert approvals.settle_if_due(booking) is True

        release.assert_called_once_with("bk-1")
        assert booking["payment_status"] == "fully_released"
        assert booking["approval_deadline_at"] is None

    def test_live_window_is_left_alone(self):
        booking = {
            "id": "bk-1",
            "payment_status": "held",
            "approval_deadline_at": _dt(+5),
        }
        with patch.object(approvals, "supabase", MagicMock()), patch.object(
            approvals.escrow, "release_escrow_on_complete"
        ) as release:
            assert approvals.settle_if_due(booking) is False
        release.assert_not_called()

    def test_nothing_to_release_clears_the_window_instead_of_retrying_forever(self):
        sb = MagicMock()
        booking = {
            "id": "bk-1",
            "payment_status": "held",
            "approval_deadline_at": _dt(-2),
        }
        with patch.object(approvals, "supabase", sb), patch.object(
            approvals.escrow,
            "release_escrow_on_complete",
            side_effect=escrow.EscrowError("never captured"),
        ):
            assert approvals.settle_if_due(booking) is False

        payload = sb.table.return_value.update.call_args_list[0].args[0]
        assert payload == {"approval_deadline_at": None}

    def test_a_read_never_raises(self):
        """settle_if_due runs inside every booking read. A moderation-style
        bookkeeping failure must not 500 someone's bookings list."""
        booking = {
            "id": "bk-1",
            "payment_status": "held",
            "approval_deadline_at": _dt(-2),
        }
        with patch.object(approvals, "supabase", MagicMock()), patch.object(
            approvals.escrow,
            "release_escrow_on_complete",
            side_effect=RuntimeError("database on fire"),
        ):
            assert approvals.settle_if_due(booking) is False


class TestSettleDue:
    def test_one_poisoned_booking_does_not_stop_the_rest(self):
        rows = [
            {"id": "ok-1", "payment_status": "held", "approval_deadline_at": _dt(-2)},
            {"id": "bad", "payment_status": "held", "approval_deadline_at": _dt(-2)},
            {"id": "ok-2", "payment_status": "held", "approval_deadline_at": _dt(-2)},
        ]
        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.not_.is_.return_value.lte.return_value.limit.return_value.execute.return_value = MagicMock(
            data=rows
        )

        def _release(booking_id):
            if booking_id == "bad":
                raise RuntimeError("nope")
            return {"outcome": "released"}

        with patch.object(approvals, "supabase", sb), patch.object(
            approvals.escrow, "release_escrow_on_complete", side_effect=_release
        ):
            summary = approvals.settle_due()

        assert summary["checked"] == 3
        assert summary["released"] == 2
        assert summary["skipped"] == 1

    def test_a_dead_lookup_returns_a_summary_not_an_exception(self):
        sb = MagicMock()
        sb.table.side_effect = RuntimeError("db down")
        with patch.object(approvals, "supabase", sb):
            assert approvals.settle_due() == {"checked": 0, "released": 0, "skipped": 0}
