"""The four sentinel blockers that survived re-verification on 2026-08-21.

Thirteen of the seventeen re-checked findings no longer reproduced — they had
been fixed on main and the sentinel was reading a stale tree. These four were
real. Each test below pins the specific mechanism, not a paraphrase of it.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.api import subscriptions
from app.services import escrow

from .conftest import SupabaseTableStub

# Resolved from THIS FILE, not the cwd: CI runs `pytest backend/tests` from the
# repo root while a local run is usually from backend/, and a cwd-relative open()
# passes in one and raises FileNotFoundError in the other.
BACKEND = Path(__file__).resolve().parents[1]


def _src(rel: str) -> str:
    return (BACKEND / rel).read_text(encoding="utf-8")

# ── SB-0188 — verified earnings could never be non-zero ──────────────────────


class TestReleasedEarningsAreCountedAsReal:
    """`is_capture_backed` excludes 'fully_released' BY DESIGN.

    Two readers filtered to fully_released and then asked that question, so the
    intersection was always empty: GET /businesses/me/analytics reported
    total_earnings 0.00 and the revenue export reported $0.00, for every
    genuinely paid, completed booking.
    """

    ROW = {
        "status": "fully_released",
        "released_to_business_cents": 9000,
        "method": "stripe_card",
        "stripe_payment_intent_id": "pi_real",
    }

    def test_the_narrow_predicate_really_does_reject_a_released_row(self):
        """If this ever becomes True, the bug below stops being possible and
        these tests should be revisited rather than deleted."""
        assert escrow.is_capture_backed(self.ROW) is False

    def test_the_historical_predicate_accepts_it(self):
        assert escrow.was_ever_captured(self.ROW) is True

    def test_a_released_row_with_no_payment_intent_is_still_rejected(self):
        """FINDING C's phantom payouts must stay in the unverified bucket."""
        phantom = {**self.ROW, "stripe_payment_intent_id": None}
        assert escrow.was_ever_captured(phantom) is False

    @pytest.mark.parametrize(
        "path",
        ["app/api/businesses.py", "app/api/analytics_export.py"],
    )
    def test_both_readers_use_the_historical_predicate(self, path):
        """The defect was choosing the wrong predicate, so the predicate choice
        is what has to be pinned."""
        src = _src(path)
        assert "was_ever_captured" in src, f"{path} lost the SB-0188 fix"


# ── SB-0206 — the soft hide was not honoured on either photo read path ───────


class TestHiddenPhotosAreNotServed:
    """`hidden_at` is set when a moderator hides a reported photo. The row
    survives for the admin trail; serving it defeats the whole moderation
    feature (App Store Guideline 1.2)."""

    def _filters(self, module, fn, *args):
        stub = SupabaseTableStub(select_data=[])
        with patch.object(module, "supabase", MagicMock()) as sb:
            sb.table.side_effect = lambda name: stub
            fn(*args)
        return [c for c in stub.calls if c[0] == "is_"]

    def test_the_proof_payload_filters_hidden_photos(self):
        from app.api import proof_of_work

        filters = self._filters(proof_of_work, proof_of_work._photos, "bk-1")
        assert ("is_", ("hidden_at", "null"), {}) in filters, (
            "proof_of_work._photos no longer filters hidden_at — a moderated "
            "photo is being served again"
        )

    def test_the_list_route_filters_hidden_photos(self):
        """Asserted at the source, because the route body is wrapped in auth
        and a party check that would dominate the test."""
        src = _src("app/api/booking_photos.py")
        assert '.is_("hidden_at", "null")' in src


# ── SB-0223 — solo pricing was unreachable after the first assigned job ──────


class TestTheOwnerIsNotTheirOwnEmployee:
    """`bookings._ensure_owner_employee` inserts the owner's own employees row
    the first time a solo operator is assigned to a job. Counting it moved them
    to team pricing permanently."""

    def _tier(self, owner_id, staff_count):
        # SupabaseTableStub derives .count from len(select_data).
        stub = SupabaseTableStub(
            select_data=[{"id": f"e{i}"} for i in range(staff_count)]
        )
        with patch.object(subscriptions, "supabase", MagicMock()) as sb:
            sb.table.side_effect = lambda name: stub
            tier, _ = subscriptions._resolve_tier_and_price("biz-1", owner_id)
        return tier, stub

    def test_the_owners_own_row_is_excluded_from_the_count(self):
        tier, stub = self._tier("owner-1", 0)
        assert tier == "solo"
        assert (
            "neq",
            ("user_id", "owner-1"),
            {},
        ) in stub.calls, "the owner's row is being counted as staff again"

    def test_a_real_employee_still_means_team(self):
        tier, _ = self._tier("owner-1", 1)
        assert tier == "team"

    def test_it_still_works_with_no_owner_id(self):
        """Back-compat: the argument is optional."""
        stub = SupabaseTableStub(select_data=[])
        with patch.object(subscriptions, "supabase", MagicMock()) as sb:
            sb.table.side_effect = lambda name: stub
            tier, _ = subscriptions._resolve_tier_and_price("biz-1")
        assert tier == "solo"
        assert not [c for c in stub.calls if c[0] == "neq"]


# ── SB-0214 — off-platform "mark paid" could erase a live Stripe capture ─────


class TestOffPlatformCannotOverwriteACapture:
    def test_a_held_row_with_an_intent_is_capture_backed(self):
        """The guard turns on this predicate, so pin what it answers. A 'held'
        row naming a PaymentIntent is real money in escrow right now."""
        row = {
            "status": "held",
            "method": "stripe_card",
            "stripe_payment_intent_id": "pi_real",
        }
        assert escrow.is_capture_backed(row) is True

    def test_an_accept_time_row_is_not_and_must_stay_markable(self):
        """The common beta case: a row exists from accept-time, nobody paid.
        Marking THAT paid off-platform is the endpoint's whole purpose."""
        row = {
            "status": "pending_payment",
            "method": None,
            "stripe_payment_intent_id": None,
        }
        assert escrow.is_capture_backed(row) is False

    def test_the_endpoint_guards_on_it_and_selects_what_it_needs(self):
        src = _src("app/api/payments_offplatform.py")
        assert "escrow.is_capture_backed(row)" in src, "SB-0214 guard is gone"
        # The guard is unwritable without these columns — selecting only
        # id+status is what made the bug possible in the first place.
        assert 'select("id, status, method, stripe_payment_intent_id")' in src
