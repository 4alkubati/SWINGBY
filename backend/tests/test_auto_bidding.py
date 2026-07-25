"""
test_auto_bidding.py — LANE 5. Auto-bidding rules, entitlement and dry run.

The four rules that must hold no matter what the UI does:

  1. Subscribers only. Only 'active' and 'trialing' are entitled.
  2. The floor is never breached.
  3. The bid never derives from the client's budget — the module must not read
     service_posts.budget at all.
  4. It cannot go live without passing through the dry run, and the daily cap /
     crew check happen at SEND time, not at save time.

Nothing here talks to a real database.
"""

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.api import auto_bidding as ab

# ── 1. Entitlement ───────────────────────────────────────────────────────────


class TestEntitlement:
    @pytest.mark.parametrize("status", ["active", "trialing", "ACTIVE", " Trialing "])
    def test_entitled_statuses(self, status):
        assert ab.is_entitled(status) is True

    @pytest.mark.parametrize(
        "status", ["past_due", "canceled", "incomplete", "unpaid", "", None]
    )
    def test_everything_else_is_locked(self, status):
        assert ab.is_entitled(status) is False

    def test_saving_rules_is_402_for_a_non_subscriber(self):
        business = {"id": "biz-1", "subscription_status": "past_due"}
        with pytest.raises(HTTPException) as exc:
            ab._require_entitled(business)
        assert exc.value.status_code == 402

    def test_get_never_402s_so_the_locked_screen_can_render(self):
        """The upgrade state has to show what the feature does."""
        business = {
            "id": "biz-1",
            "subscription_status": "canceled",
            "lat": None,
            "lng": None,
        }
        with patch.object(ab, "_owner_business", return_value=business), patch.object(
            ab, "_load_rules", return_value={"business_id": "biz-1", **ab.DEFAULT_RULES}
        ):
            out = ab.get_auto_bid(current_user={"id": "u", "role": "business_owner"})
        assert out["entitled"] is False
        assert out["rules"]["enabled"] is False


# ── 2. The floor is never breached ───────────────────────────────────────────


class TestBidMath:
    def test_bid_is_rate_times_scope(self):
        # $55/hr over a 3 h job = $165
        assert ab.compute_bid_cents(5500, 3.0, 0) == 16500

    def test_below_floor_is_clamped_up_never_down(self):
        # $55/hr over 1 h = $55, floor $120 → quote the floor
        assert ab.compute_bid_cents(5500, 1.0, 12000) == 12000

    def test_above_floor_is_untouched(self):
        assert ab.compute_bid_cents(5500, 4.0, 12000) == 22000

    @pytest.mark.parametrize("hours", [0.25, 1.0, 2.5, 8.0])
    def test_never_returns_below_the_floor(self, hours):
        assert ab.compute_bid_cents(5500, hours, 12000) >= 12000

    def test_result_is_integer_cents(self):
        out = ab.compute_bid_cents(5500, 3.5, 0)
        assert isinstance(out, int)
        assert out == 19250


# ── 3. The client's budget is never an input ─────────────────────────────────


class TestBudgetIsInvisible:
    def test_scope_comes_from_the_category_only(self):
        assert ab.estimate_scope_hours("deep clean") == 3.5
        assert ab.estimate_scope_hours("Move-Out") == 5.0
        assert ab.estimate_scope_hours("something we've never seen") == (
            ab.DEFAULT_SCOPE_HOURS
        )
        assert ab.estimate_scope_hours(None) == ab.DEFAULT_SCOPE_HOURS

    def test_module_code_never_reads_budget(self):
        """Guard against a future edit quietly re-introducing the leak.

        Strips comments and string literals with `tokenize`, so the many
        comments that mention budget-must-not-be-read don't mask a real read —
        and a select string like "id, budget" WOULD still be caught, because it
        is checked separately below.
        """
        import io
        import inspect
        import tokenize

        src = inspect.getsource(ab)

        code_tokens = [
            tok
            for tok in tokenize.generate_tokens(io.StringIO(src).readline)
            if tok.type not in (tokenize.COMMENT, tokenize.NL)
        ]
        identifiers = [t.string for t in code_tokens if t.type == tokenize.NAME]
        assert not any("budget" in name.lower() for name in identifiers)

        # Any string literal that looks like a PostgREST column list must not
        # name budget — that is the only way it could reach a response.
        literals = [
            t.string.lower()
            for t in code_tokens
            if t.type == tokenize.STRING
            and not t.string.lstrip("rbfu").startswith(('"""', "'''"))
        ]
        offenders = [s for s in literals if "budget" in s]
        assert offenders == [], offenders

    def test_dry_run_row_carries_no_budget_field(self):
        business = {"id": "b", "lat": 51.05, "lng": -114.07}
        rules = {
            "categories": ["cleaning"],
            "radius_km": 20,
            "hourly_rate_cents": 5500,
            "floor_cents": 12000,
        }
        post = {
            "id": "p1",
            "title": "Deep clean",
            "category": "cleaning",
            "lat": 51.06,
            "lng": -114.08,
            "address": "Hillhurst, Calgary",
        }
        row = ab._evaluate_post(post, rules, business)
        assert "budget" not in row
        assert row["matched"] is True
        assert row["bid_cents"] >= 12000


# ── 4. Matching + skip reasons ───────────────────────────────────────────────


class TestEvaluate:
    business = {"id": "b", "lat": 51.0447, "lng": -114.0719}
    rules = {
        "categories": ["cleaning"],
        "radius_km": 12,
        "hourly_rate_cents": 5500,
        "floor_cents": 12000,
        "max_bids_per_day": 8,
    }

    def test_too_far_is_skipped_with_the_distance_in_the_reason(self):
        far = {
            "id": "p",
            "title": "Office weekly",
            "category": "cleaning",
            "lat": 51.25,
            "lng": -114.07,
            "address": "Airdrie",
        }
        row = ab._evaluate_post(far, self.rules, self.business)
        assert row["matched"] is False
        assert "too far" in row["reason"]
        assert str(row["distance_km"]) in row["reason"]

    def test_wrong_category_is_skipped(self):
        post = {
            "id": "p",
            "title": "Leaky tap",
            "category": "plumbing",
            "lat": 51.045,
            "lng": -114.072,
            "address": "Kensington",
        }
        row = ab._evaluate_post(post, self.rules, self.business)
        assert row["matched"] is False
        assert row["reason"] == "Not in your services"

    def test_missing_coordinates_do_not_crash_the_dry_run(self):
        post = {
            "id": "p",
            "title": "Deep clean",
            "category": "cleaning",
            "lat": None,
            "lng": None,
            "address": None,
        }
        row = ab._evaluate_post(post, self.rules, self.business)
        assert row["distance_km"] is None
        assert row["matched"] is True

    def test_no_rate_set_reports_it_rather_than_bidding_zero(self):
        rules = {**self.rules, "hourly_rate_cents": 0, "floor_cents": 0}
        post = {
            "id": "p",
            "title": "Deep clean",
            "category": "cleaning",
            "lat": 51.045,
            "lng": -114.072,
            "address": "Kensington",
        }
        row = ab._evaluate_post(post, rules, self.business)
        assert row["matched"] is False
        assert row["reason"] == "Set your rate first"

    def test_dry_run_totals(self):
        posts = [
            {
                "id": "1",
                "title": "Deep clean",
                "category": "cleaning",
                "lat": 51.045,
                "lng": -114.072,
                "address": "Hillhurst",
            },
            {
                "id": "2",
                "title": "Office",
                "category": "cleaning",
                "lat": 51.30,
                "lng": -114.07,
                "address": "Airdrie",
            },
        ]
        out = ab.run_dry_run(posts, self.rules, self.business)
        assert out["considered"] == 2
        assert out["matched"] == 1
        assert out["would_bid_cents"] >= 12000
        assert out["window_days"] == 7


# ── 5. The dry-run gate and send-time checks ─────────────────────────────────


class TestGate:
    def test_cannot_enable_without_a_dry_run(self):
        business = {"id": "biz-1", "subscription_status": "active"}
        current = {**ab.DEFAULT_RULES, "dry_run_passed_at": None}
        body = ab.AutoBidRulesIn(
            enabled=True,
            categories=["cleaning"],
            hourly_rate_cents=5500,
            floor_cents=12000,
        )
        with patch.object(ab, "_owner_business", return_value=business), patch.object(
            ab, "_load_rules", return_value=current
        ), patch.object(ab, "_save_rules") as save:
            with pytest.raises(HTTPException) as exc:
                ab.put_auto_bid(
                    body, current_user={"id": "u", "role": "business_owner"}
                )
        assert exc.value.status_code == 409
        save.assert_not_called()

    def test_activate_records_the_dry_run_and_goes_live(self):
        business = {"id": "biz-1", "subscription_status": "trialing"}
        body = ab.AutoBidRulesIn(
            categories=["cleaning"],
            hourly_rate_cents=5500,
            floor_cents=12000,
        )
        with patch.object(ab, "_owner_business", return_value=business), patch.object(
            ab, "_save_rules", side_effect=lambda _bid, patch_: patch_
        ), patch.object(ab, "_auto_bids_sent_today", return_value=0):
            out = ab.post_activate(
                body, current_user={"id": "u", "role": "business_owner"}
            )
        assert out["rules"]["enabled"] is True
        assert out["rules"]["dry_run_passed_at"] is not None

    def test_activate_refuses_an_incomplete_rule_set(self):
        business = {"id": "biz-1", "subscription_status": "active"}
        body = ab.AutoBidRulesIn(categories=[], hourly_rate_cents=0, floor_cents=0)
        with patch.object(ab, "_owner_business", return_value=business), patch.object(
            ab, "_save_rules"
        ) as save:
            with pytest.raises(HTTPException) as exc:
                ab.post_activate(
                    body, current_user={"id": "u", "role": "business_owner"}
                )
        assert exc.value.status_code == 400
        save.assert_not_called()

    def test_dry_run_writes_nothing(self):
        business = {
            "id": "biz-1",
            "subscription_status": "active",
            "lat": 51.0,
            "lng": -114.0,
        }
        body = ab.AutoBidRulesIn(
            categories=["cleaning"], hourly_rate_cents=5500, floor_cents=12000
        )
        with patch.object(ab, "_owner_business", return_value=business), patch.object(
            ab, "_load_rules", return_value=ab.DEFAULT_RULES
        ), patch.object(ab, "_recent_posts", return_value=[]), patch.object(
            ab, "_save_rules"
        ) as save:
            out = ab.post_dry_run(
                body, current_user={"id": "u", "role": "business_owner"}
            )
        save.assert_not_called()
        assert out["matched"] == 0


class TestSendTimeChecks:
    live = {
        "enabled": True,
        "dry_run_passed_at": "2026-07-24T00:00:00Z",
        "max_bids_per_day": 8,
        "require_free_crew": True,
    }

    def test_sends_when_everything_is_clear(self):
        ok, why = ab.can_send_now(self.live, sent_today=3, crew_free=True)
        assert ok is True and why is None

    def test_daily_cap_is_checked_at_send_time(self):
        ok, why = ab.can_send_now(self.live, sent_today=8, crew_free=True)
        assert ok is False and why == "daily cap reached"

    def test_crew_availability_is_checked_at_send_time(self):
        ok, why = ab.can_send_now(self.live, sent_today=0, crew_free=False)
        assert ok is False and why == "no crew free"

    def test_crew_check_can_be_turned_off(self):
        rules = {**self.live, "require_free_crew": False}
        ok, _ = ab.can_send_now(rules, sent_today=0, crew_free=False)
        assert ok is True

    def test_off_means_off(self):
        ok, why = ab.can_send_now(
            {**self.live, "enabled": False}, sent_today=0, crew_free=True
        )
        assert ok is False and why == "auto-bidding is off"

    def test_no_dry_run_means_no_send_even_if_enabled_somehow(self):
        ok, why = ab.can_send_now(
            {**self.live, "dry_run_passed_at": None}, sent_today=0, crew_free=True
        )
        assert ok is False and why == "dry run not completed"

    def test_withdraw_window_is_five_minutes(self):
        sent = datetime(2026, 7, 24, 12, 0, tzinfo=timezone.utc)
        assert (ab.withdraw_deadline(sent) - sent).total_seconds() == 300


class TestCapCountingFailsClosed:
    def test_an_unreadable_count_blocks_sending_rather_than_allowing_it(self):
        with patch.object(ab, "supabase") as supa:
            supa.table.side_effect = RuntimeError("postgrest down")
            count = ab._auto_bids_sent_today("biz-1")
        ok, why = ab.can_send_now(
            TestSendTimeChecks.live, sent_today=count, crew_free=True
        )
        assert ok is False and why == "daily cap reached"
