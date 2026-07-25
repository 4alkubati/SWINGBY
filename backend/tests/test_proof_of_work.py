"""
test_proof_of_work.py — LANE 5. Proof-of-work submission + approve/release.

The gate this covers is the last one before money moves, so the tests are about
the rules rather than the plumbing:

  * the 2 + 2 minimum counts BUSINESS photos only — a client's job-post photo
    can never unlock "Send for approval" (walkthrough M5);
  * the voice memo never blocks the CTA (spec §1);
  * the release amount the client is shown is the real ledger number;
  * approve is idempotent and refuses to release a disputed or
    never-captured booking.

Nothing here talks to Stripe or a real database.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import sqlparse
from fastapi import HTTPException

from app.api import proof_of_work as pow_api

REPO_ROOT = Path(__file__).parent.parent.parent
MIGRATION = (
    REPO_ROOT
    / "supabase"
    / "migrations"
    / "20260724090000_proof_of_work_and_auto_bidding.sql"
)


def _photo(phase, source="business", n=1):
    return [{"phase": phase, "source": source, "url": f"u{i}"} for i in range(n)]


# ── The 2 + 2 minimum ────────────────────────────────────────────────────────


class TestCounts:
    def test_two_and_two_business_photos_can_submit(self):
        c = pow_api.counts(_photo("before", n=2) + _photo("after", n=2))
        assert c["before"] == 2 and c["after"] == 2
        assert c["can_submit"] is True
        assert c["before_needed"] == 0 and c["after_needed"] == 0

    def test_one_short_reports_what_is_missing(self):
        c = pow_api.counts(_photo("before", n=2) + _photo("after", n=1))
        assert c["can_submit"] is False
        assert c["after_needed"] == 1

    def test_client_supplied_photos_never_satisfy_the_minimum(self):
        """M5: the client's job-post photos pre-fill BEFORE but are not proof."""
        photos = _photo("before", source="client", n=4) + _photo("after", n=2)
        c = pow_api.counts(photos)
        assert c["before"] == 0
        assert c["before_needed"] == 2
        assert c["can_submit"] is False

    def test_legacy_rows_without_source_count_as_business(self):
        # booking_photos rows written before migration 20260724090000 have no
        # `source`; they were all provider uploads.
        photos = [
            {"phase": "before"},
            {"phase": "before"},
            {"phase": "after"},
            {"phase": "after"},
        ]
        assert pow_api.counts(photos)["can_submit"] is True

    def test_empty_is_not_submittable(self):
        c = pow_api.counts([])
        assert c["can_submit"] is False
        assert c["before_needed"] == 2 and c["after_needed"] == 2


# ── Release amount shown to the client ───────────────────────────────────────


class TestReleasePreview:
    def test_release_is_total_minus_platform_cut(self):
        payment = {
            "total_charged_cents": 19500,
            "platform_cut_cents": 1950,
            "released_to_business_cents": 0,
        }
        out = pow_api.release_preview(payment)
        assert out["release_cents"] == 17550
        assert out["total_cents"] == 19500

    def test_already_released_is_not_released_twice(self):
        payment = {
            "total_charged_cents": 19500,
            "platform_cut_cents": 1950,
            "released_to_business_cents": 17550,
        }
        assert pow_api.release_preview(payment)["release_cents"] == 0

    def test_no_payment_row_shows_zero_rather_than_guessing(self):
        assert pow_api.release_preview(None)["release_cents"] == 0


# ── Submit gate ──────────────────────────────────────────────────────────────


BOOKING = {
    "id": "bk-1",
    "client_id": "client-1",
    "business_id": "biz-1",
    "employee_id": None,
    "post_id": "post-1",
    "status": "in_progress",
    "service_category": "cleaning",
    "confirmed_date": None,
}
OWNER = {"id": "owner-1", "role": "business_owner"}
CLIENT = {"id": "client-1", "role": "client"}


@pytest.fixture
def as_provider():
    with patch.object(pow_api, "_load_booking", return_value=BOOKING), patch.object(
        pow_api, "_is_provider", return_value=True
    ), patch.object(pow_api, "_is_client", return_value=False):
        yield


@pytest.fixture
def as_client():
    with patch.object(pow_api, "_load_booking", return_value=BOOKING), patch.object(
        pow_api, "_is_provider", return_value=False
    ), patch.object(pow_api, "_is_client", return_value=True):
        yield


class TestSubmit:
    def test_submit_rejected_below_the_minimum(self, as_provider):
        with patch.object(pow_api, "_photos", return_value=_photo("before", n=2)):
            with pytest.raises(HTTPException) as exc:
                pow_api.submit_proof("bk-1", current_user=OWNER)
        assert exc.value.status_code == 400
        assert "after photo" in exc.value.detail

    def test_submit_succeeds_with_two_and_two_and_no_voice_memo(self, as_provider):
        """Spec §1: 'Never block the CTA on the voice memo.'"""
        photos = _photo("before", n=2) + _photo("after", n=2)
        with patch.object(pow_api, "_photos", return_value=photos), patch.object(
            pow_api, "_load_proof", return_value=None
        ), patch.object(
            pow_api, "_upsert_proof", return_value={"status": "submitted"}
        ) as upsert:
            out = pow_api.submit_proof("bk-1", current_user=OWNER)
        assert out["proof"]["status"] == "submitted"
        assert upsert.call_args[0][1]["status"] == "submitted"

    def test_cannot_resubmit_after_approval(self, as_provider):
        with patch.object(pow_api, "_load_proof", return_value={"status": "approved"}):
            with pytest.raises(HTTPException) as exc:
                pow_api.submit_proof("bk-1", current_user=OWNER)
        assert exc.value.status_code == 409


# ── Approve / release ────────────────────────────────────────────────────────


class TestApprove:
    def test_approve_before_submission_is_refused(self, as_client):
        with patch.object(pow_api, "_load_proof", return_value=None):
            with pytest.raises(HTTPException) as exc:
                pow_api.approve_proof("bk-1", current_user=CLIENT)
        assert exc.value.status_code == 409

    def test_approve_is_idempotent(self, as_client):
        """A double-tap must not release twice."""
        with patch.object(
            pow_api, "_load_proof", return_value={"status": "approved"}
        ), patch.object(pow_api.escrow, "release_escrow_on_complete") as release:
            out = pow_api.approve_proof("bk-1", current_user=CLIENT)
        assert out["outcome"] == "already_approved"
        release.assert_not_called()

    def test_disputed_work_cannot_be_approved(self, as_client):
        with patch.object(
            pow_api, "_load_proof", return_value={"status": "disputed"}
        ), patch.object(pow_api.escrow, "release_escrow_on_complete") as release:
            with pytest.raises(HTTPException) as exc:
                pow_api.approve_proof("bk-1", current_user=CLIENT)
        assert exc.value.status_code == 409
        release.assert_not_called()

    def test_uncaptured_money_blocks_the_release(self, as_client):
        """escrow FINDING C: never pay out what was never collected."""
        with patch.object(
            pow_api, "_load_proof", return_value={"status": "submitted"}
        ), patch.object(
            pow_api.escrow,
            "release_escrow_on_complete",
            side_effect=pow_api.escrow.CaptureRequiredError("no intent"),
        ), patch.object(
            pow_api, "_upsert_proof"
        ) as upsert:
            with pytest.raises(HTTPException) as exc:
                pow_api.approve_proof("bk-1", current_user=CLIENT)
        assert exc.value.status_code == 409
        # Nothing was marked approved.
        upsert.assert_not_called()

    def test_happy_path_releases_then_marks_approved(self, as_client):
        supa = MagicMock()
        with patch.object(
            pow_api, "_load_proof", return_value={"status": "submitted"}
        ), patch.object(
            pow_api.escrow,
            "release_escrow_on_complete",
            return_value={
                "outcome": "released",
                "payment": {"status": "fully_released"},
            },
        ) as release, patch.object(
            pow_api, "_upsert_proof", return_value={"status": "approved"}
        ) as upsert, patch.object(
            pow_api, "supabase", supa
        ):
            out = pow_api.approve_proof("bk-1", current_user=CLIENT)

        release.assert_called_once_with("bk-1")
        assert upsert.call_args[0][1]["status"] == "approved"
        assert out["outcome"] == "released"


class TestDecline:
    def test_something_is_wrong_holds_the_funds(self, as_client):
        with patch.object(
            pow_api, "_load_proof", return_value={"status": "submitted"}
        ), patch.object(
            pow_api, "_upsert_proof", return_value={"status": "disputed"}
        ), patch.object(
            pow_api.escrow, "release_escrow_on_complete"
        ) as release:
            out = pow_api.decline_proof("bk-1", current_user=CLIENT)
        assert out["funds_held"] is True
        assert out["proof"]["status"] == "disputed"
        release.assert_not_called()

    def test_cannot_dispute_after_the_money_moved(self, as_client):
        with patch.object(pow_api, "_load_proof", return_value={"status": "approved"}):
            with pytest.raises(HTTPException) as exc:
                pow_api.decline_proof("bk-1", current_user=CLIENT)
        assert exc.value.status_code == 409


# ── Voice memo cap ───────────────────────────────────────────────────────────


class TestVoiceNoteCap:
    def test_sixty_seconds_is_the_hard_cap(self):
        assert pow_api.MAX_VOICE_NOTE_SECONDS == 60
        with pytest.raises(Exception):
            pow_api.VoiceNoteIn(url="u", path="p", duration_seconds=61)

    def test_zero_length_memo_is_rejected(self):
        with pytest.raises(Exception):
            pow_api.VoiceNoteIn(url="u", path="p", duration_seconds=0)

    def test_a_valid_memo_parses(self):
        v = pow_api.VoiceNoteIn(url="u", path="p", duration_seconds=18)
        assert v.duration_seconds == 18


# ── The migration ships with the code ────────────────────────────────────────


class TestMigrationShipsWithTheCode:
    """A filed-but-unapplied migration is how the schema drifts. At minimum the
    file has to exist next to the endpoints that need it and parse as SQL."""

    def test_migration_file_exists(self):
        assert MIGRATION.exists(), f"missing {MIGRATION}"

    def test_migration_parses(self):
        text = MIGRATION.read_text()
        assert text.strip()
        assert len(sqlparse.parse(text)) > 5

    def test_migration_is_additive_only(self):
        """No drop/truncate/alter-type — this ships to a live database."""
        lowered = MIGRATION.read_text().lower()
        for forbidden in ("drop table", "drop column", "truncate", "alter column"):
            assert forbidden not in lowered, forbidden
        # `drop policy if exists` is the sanctioned idempotency idiom.
        assert lowered.count("drop policy if exists") == lowered.count("drop policy")

    def test_migration_creates_what_the_api_reads(self):
        lowered = MIGRATION.read_text().lower()
        for table in (
            "public.booking_voice_notes",
            "public.booking_proofs",
            "public.business_auto_bid_rules",
        ):
            assert f"create table if not exists {table}" in lowered
        assert "add column if not exists source" in lowered
        assert "add column if not exists is_auto" in lowered

    def test_voice_note_cap_is_enforced_in_the_database_too(self):
        """60 s is a product rule, not a UI preference."""
        lowered = MIGRATION.read_text().lower()
        assert "duration_seconds <= 60" in lowered

    def test_auto_bid_cannot_be_enabled_without_a_dry_run_at_the_db_level(self):
        lowered = MIGRATION.read_text().lower()
        assert "enabled = false or dry_run_passed_at is not null" in lowered
