"""
test_completion_without_proof.py — SB-0009: money can auto-release against a
job with no evidence that any work happened.

A booking reached "Job complete" with the Proof of work section reading "No
photos yet / No before photos yet / No after photos yet", and the 24h
auto-release clock started anyway. The release itself is real and works —
`settle_if_due` lazily on read, plus POST /admin/sweeps/approval-releases — so
after 24h of client silence the escrow moves to the business against a job with
nothing on record. A client disputing it has nothing to point at.

THE POLICY CHOICE, stated so the next reader does not have to guess.

Blocking completion on a photo was rejected. `proof_of_work` already has a 2+2
minimum for submitting a proof BUNDLE, and imposing it on "mark done" would
strand every job whose proof is not visual — a consultation, a quote visit, a
callout that turned out to need no work. Refusing to let those be completed
would be a worse bug than the one being fixed, and it would push businesses to
photograph something irrelevant to get past the gate.

So completion stays permitted and stops being SILENT. The timeline event the
client reads says plainly that no proof was recorded, on the same event that
starts the countdown — at the moment the client is deciding whether to approve.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.services import approvals


@pytest.fixture
def captured_events():
    """Collect the timeline notes `start_approval_window` emits."""
    notes = []

    def fake_event(booking_id, actor_id, event_type, note):
        notes.append(note)

    with patch.object(approvals, "_event", side_effect=fake_event):
        yield notes


def _supabase_with_photos(photo_rows):
    """Stub: booking_photos returns `photo_rows`, everything else is inert."""
    supabase = MagicMock()

    def table(name):
        handle = MagicMock()
        if name == "booking_photos":
            chain = handle.select.return_value.eq.return_value
            chain.execute.return_value = MagicMock(data=photo_rows)
        else:
            handle.update.return_value.eq.return_value.execute.return_value = MagicMock(
                data=[]
            )
        return handle

    supabase.table.side_effect = table
    return supabase


class TestCompletionSaysWhenThereIsNoProof:
    def test_no_photos_is_stated_on_the_event_that_starts_the_clock(
        self, captured_events
    ):
        with patch.object(
            approvals, "needs_approval_window", return_value=True
        ), patch.object(approvals, "supabase", _supabase_with_photos([])):
            approvals.start_approval_window("bk-1", "biz-user-1")

        assert captured_events, "no timeline event was emitted at all"
        note = captured_events[-1].lower()
        assert "no proof" in note or "no photo" in note, (
            "the client is told the money auto-releases in 24h but not that "
            "nothing was recorded to justify it (SB-0009). note was: "
            f"{captured_events[-1]!r}"
        )
        assert "24h" in captured_events[-1], (
            "the countdown must still be stated — this adds a fact, it does not "
            "replace one"
        )

    def test_a_job_with_proof_reads_normally(self, captured_events):
        """The warning must be absent when it would be false."""
        photos = [
            {"phase": "before", "source": "business"},
            {"phase": "after", "source": "business"},
        ]
        with patch.object(
            approvals, "needs_approval_window", return_value=True
        ), patch.object(approvals, "supabase", _supabase_with_photos(photos)):
            approvals.start_approval_window("bk-2", "biz-user-1")

        note = captured_events[-1].lower()
        assert "no proof" not in note and "no photo" not in note
        assert "24h" in captured_events[-1]

    def test_client_supplied_photos_do_not_count_as_proof(self, captured_events):
        """
        Photos from the client's own job post are not evidence of work done —
        proof_of_work.counts() already excludes them from the 2+2 minimum for
        exactly this reason, and this must agree with it.
        """
        photos = [{"phase": "before", "source": "client"}]
        with patch.object(
            approvals, "needs_approval_window", return_value=True
        ), patch.object(approvals, "supabase", _supabase_with_photos(photos)):
            approvals.start_approval_window("bk-3", "biz-user-1")

        note = captured_events[-1].lower()
        assert "no proof" in note or "no photo" in note

    def test_a_cash_job_still_completes_without_a_countdown(self, captured_events):
        """No escrow to gate means no approval window and nothing to warn about."""
        with patch.object(
            approvals, "needs_approval_window", return_value=False
        ), patch.object(approvals, "supabase", _supabase_with_photos([])):
            deadline = approvals.start_approval_window("bk-4", "biz-user-1")

        assert deadline is None
        assert "24h" not in captured_events[-1]
