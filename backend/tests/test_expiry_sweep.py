"""The sweep that makes charge-at-post honest.

Charging a client's full budget when they post is only defensible if the money
comes back when nobody takes the job. Nothing else in the app would tell them:
there is no booking, no invoice and no screen for a post that expired unquoted.
The only party who could notice is the one who cannot see the ledger.

These tests exist because a silent failure here is invisible by construction.
"""

import inspect
from types import SimpleNamespace
from unittest.mock import patch

from app.services import expiry_sweep, refunds


def _post(pid="post_1", status="open"):
    return {
        "id": pid,
        "client_id": "client_1",
        "title": "Deep clean",
        "status": status,
        "expires_at": "2026-07-01T00:00:00+00:00",
    }


def _payment(held=15000, intent="pi_1"):
    return {
        "id": "pay_1",
        "post_id": "post_1",
        "stripe_payment_intent_id": intent,
        "total_charged_cents": 15000,
        "escrow_held_cents": held,
        "released_to_business_cents": 0,
        "platform_cut_cents": 0,
        "refunded_cents": 0,
        "status": "held",
    }


class TestTheMoneyComesBack:
    def test_an_expired_unquoted_post_is_refunded_in_full(self):
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=[_post()]
        ), patch.object(
            refunds, "load_post_payment", return_value=_payment()
        ), patch.object(
            refunds, "refund_payment_row"
        ) as refund, patch.object(
            expiry_sweep, "supabase"
        ):
            s = expiry_sweep.sweep_once()
            assert s["refunded"] == 1
            assert s["refunded_cents"] == 15000
            assert refund.call_args.kwargs["amount_cents"] == 15000
            assert refund.call_args.kwargs["reason"] == refunds.REASON_EXPIRED

    def test_the_post_is_marked_expired_after_the_money_moves(self):
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=[_post()]
        ), patch.object(
            refunds, "load_post_payment", return_value=_payment()
        ), patch.object(
            refunds, "refund_payment_row"
        ), patch.object(
            expiry_sweep, "supabase"
        ) as db:
            expiry_sweep.sweep_once()
            db.table.return_value.update.assert_called_with({"status": "expired"})


class TestTheClientIsActuallyTold:
    """The money moving is half the job; the client knowing is the other half.

    For a long time the sweep did the first half only, so the refund arrived as
    an unexplained card credit against a post that had silently vanished from My
    Jobs. From the client's side that is indistinguishable from the app losing
    their job and their money.
    """

    def test_the_client_gets_a_push_naming_the_amount(self):
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=[_post()]
        ), patch.object(
            refunds, "load_post_payment", return_value=_payment()
        ), patch.object(
            refunds, "refund_payment_row"
        ), patch.object(
            expiry_sweep, "supabase"
        ), patch(
            "app.services.push.send_push_to_user"
        ) as push:
            expiry_sweep.sweep_once()

            assert push.call_count == 1
            user_id, title, body = push.call_args.args
            assert user_id == "client_1"
            # The amount has to be in the message. "Your post expired" next to a
            # mystery credit on a statement is worse than saying nothing.
            assert "150.00" in body
            assert "Deep clean" in body
            assert "refund" in (title + body).lower()

    def test_no_push_when_there_was_no_money_to_return(self):
        # Flow B: never charged, so there is nothing to announce. Telling someone
        # they have been refunded $0 is a support ticket, not a courtesy.
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=[_post()]
        ), patch.object(refunds, "load_post_payment", return_value=None), patch.object(
            expiry_sweep, "supabase"
        ), patch(
            "app.services.push.send_push_to_user"
        ) as push:
            expiry_sweep.sweep_once()
            push.assert_not_called()

    def test_a_broken_push_does_not_unsettle_a_settled_post(self):
        # The money and the status are load-bearing. A push failure must not make
        # the next run think this post still owes anything.
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=[_post()]
        ), patch.object(
            refunds, "load_post_payment", return_value=_payment()
        ), patch.object(
            refunds, "refund_payment_row"
        ), patch.object(
            expiry_sweep, "supabase"
        ), patch(
            "app.services.push.send_push_to_user", side_effect=RuntimeError("expo down")
        ):
            s = expiry_sweep.sweep_once()
            assert s["refunded"] == 1
            assert s["expired_marked"] == 1
            assert s["failed"] == 0


class TestFailureLeavesTheDebtVisible:
    def test_a_failed_refund_does_NOT_mark_the_post_expired(self):
        # Marking it expired would hide an unpaid debt behind a settled state,
        # and the next sweep would never look at it again.
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=[_post()]
        ), patch.object(
            refunds, "load_post_payment", return_value=_payment()
        ), patch.object(
            refunds, "refund_payment_row", side_effect=Exception("stripe down")
        ), patch.object(
            expiry_sweep, "supabase"
        ) as db:
            s = expiry_sweep.sweep_once()
            assert s["failed"] == 1
            assert s["expired_marked"] == 0
            db.table.return_value.update.assert_not_called()

    def test_one_bad_post_does_not_abandon_the_others(self):
        posts = [_post("bad"), _post("good")]
        payments = {"bad": _payment(), "good": _payment()}
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=posts
        ), patch.object(
            refunds, "load_post_payment", side_effect=lambda pid: payments[pid]
        ), patch.object(
            refunds, "refund_payment_row", side_effect=[Exception("boom"), None]
        ), patch.object(
            expiry_sweep, "supabase"
        ):
            s = expiry_sweep.sweep_once()
            assert s["failed"] == 1
            assert s["refunded"] == 1

    def test_a_dead_database_yields_an_empty_list_not_an_exception(self):
        # The REAL function, with the DB blowing up underneath it. A sweep that
        # dies on startup is a sweep nobody notices has stopped running.
        with patch.object(expiry_sweep, "supabase") as db:
            db.table.side_effect = Exception("db gone")
            assert expiry_sweep.find_expired_unquoted_posts() == []

    def test_sweep_once_survives_a_dead_database(self):
        with patch.object(expiry_sweep, "supabase") as db:
            db.table.side_effect = Exception("db gone")
            s = expiry_sweep.sweep_once()
            assert s["examined"] == 0
            assert s["failed"] == 0


class TestIdempotence:
    def test_an_already_swept_post_is_not_refunded_twice(self):
        # Zero escrow is the evidence, not a flag that could drift from the money.
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=[_post()]
        ), patch.object(
            refunds, "load_post_payment", return_value=_payment(held=0)
        ), patch.object(
            refunds, "refund_payment_row"
        ) as refund, patch.object(
            expiry_sweep, "supabase"
        ):
            s = expiry_sweep.sweep_once()
            refund.assert_not_called()
            assert s["nothing_to_refund"] == 1

    def test_a_post_that_was_never_charged_still_expires_cleanly(self):
        # Flow B: nothing was taken at post, so there is nothing to give back.
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=[_post()]
        ), patch.object(refunds, "load_post_payment", return_value=None), patch.object(
            refunds, "refund_payment_row"
        ) as refund, patch.object(
            expiry_sweep, "supabase"
        ):
            s = expiry_sweep.sweep_once()
            refund.assert_not_called()
            assert s["expired_marked"] == 1

    def test_no_captured_intent_is_not_counted_as_a_failure(self):
        with patch.object(
            expiry_sweep, "find_expired_unquoted_posts", return_value=[_post()]
        ), patch.object(
            refunds, "load_post_payment", return_value=_payment(intent=None)
        ), patch.object(
            refunds,
            "refund_payment_row",
            side_effect=refunds.RefundNotPossible("nothing to refund"),
        ), patch.object(
            expiry_sweep, "supabase"
        ):
            s = expiry_sweep.sweep_once()
            assert s["failed"] == 0
            assert s["nothing_to_refund"] == 1
            assert s["expired_marked"] == 1


class TestScope:
    def test_only_unsettled_posts_are_swept(self):
        """What must NOT be swept, and why — rather than the exact tuple.

        This asserted `SWEEPABLE_STATUSES == ("open",)`. The intent underneath
        it is the line below: 'matched' has a booking behind it, so that money
        belongs to the job. Freezing the whole tuple also froze the exclusion of
        'expired', which was a bug rather than a decision (SB-0074) — the hourly
        pg_cron sets that status and moves no money, so a post it expired could
        never be refunded. Pin the property, not the literal.
        """
        # 'matched' has a booking behind it — that money belongs to the job.
        assert "matched" not in expiry_sweep.SWEEPABLE_STATUSES
        # 'cancelled' was settled by the cancellation ladder on its way out.
        assert "cancelled" not in expiry_sweep.SWEEPABLE_STATUSES
        # Both routes a post can reach "nobody quoted this" by:
        assert "open" in expiry_sweep.SWEEPABLE_STATUSES
        assert "expired" in expiry_sweep.SWEEPABLE_STATUSES


class TestTheSweepIsActuallyReachable:
    """The whole point of this round of work.

    `sweep_once` was written weeks before 2026-07-31 and called by nothing but
    the tests above it. There is no scheduler in this deployment — no cron
    service, no worker, no APScheduler — so every guarantee in the module
    docstring was true of code that never ran. Expired posts stayed 'open'
    forever and any escrow against them was never returned.

    These tests pin the wiring, not the refund logic: that a real request path
    reaches the sweep, and that it cannot take a read down with it.
    """

    def test_service_posts_my_sweeps_the_caller_first(self):
        import app.api.service_posts as sp

        source = inspect.getsource(sp.list_my_posts)
        assert "sweep_for_client" in source, (
            "GET /service-posts/my must settle the client's expired posts — it "
            "is the only read whose caller is the person owed the refund."
        )

    def test_the_business_feed_hides_expired_posts(self):
        import app.api.service_posts as sp

        source = inspect.getsource(sp.list_open_posts)
        assert 'gt("expires_at"' in source, (
            "A post keeps status='open' until something sweeps it, so the feed "
            "must exclude it by date or businesses can quote dead posts."
        )

    def test_an_admin_endpoint_can_drive_it_in_bulk(self):
        import app.api.admin as admin_api

        assert hasattr(admin_api, "sweep_post_expiry")
        source = inspect.getsource(admin_api.sweep_post_expiry)
        assert "expiry_sweep.sweep_once()" in source

    def test_sweep_for_client_narrows_to_that_client(self):
        seen = {}

        def fake_sweep(now=None, limit=200, client_id=None):
            seen["client_id"] = client_id
            seen["limit"] = limit
            return {"examined": 0}

        with patch.object(expiry_sweep, "sweep_once", side_effect=fake_sweep):
            expiry_sweep.sweep_for_client("client-7")

        assert seen["client_id"] == "client-7"
        assert seen["limit"] <= 50, "a read path must stay bounded"

    def test_sweep_for_client_never_raises_into_the_read(self):
        # A failing sweep must not stop someone seeing their own jobs.
        with patch.object(expiry_sweep, "sweep_once", side_effect=Exception("boom")):
            assert expiry_sweep.sweep_for_client("client-7") == {}

    def test_sweep_for_client_is_a_no_op_without_an_id(self):
        with patch.object(expiry_sweep, "sweep_once") as swept:
            assert expiry_sweep.sweep_for_client("") == {}
        swept.assert_not_called()

    def test_find_expired_filters_by_client_when_asked(self):
        calls = []

        class _Q:
            def select(self, *a, **k):
                return self

            def in_(self, *a, **k):
                return self

            def lt(self, *a, **k):
                return self

            def eq(self, col, val):
                calls.append((col, val))
                return self

            def order(self, *a, **k):
                return self

            def limit(self, *a, **k):
                return self

            def execute(self):
                return SimpleNamespace(data=[])

        with patch.object(expiry_sweep, "supabase") as sb:
            sb.table.return_value = _Q()
            expiry_sweep.find_expired_unquoted_posts(client_id="client-9")

        assert ("client_id", "client-9") in calls
