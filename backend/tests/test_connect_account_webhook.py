"""
test_connect_account_webhook.py — SB-0080: account.updated was subscribed and
unhandled.

DEC-5 recorded the gap. What kept it from mattering is reconcile-on-read: every
gate in payouts.py re-reads Stripe and calls `_mirror_account_state`, so the
cached connect_* columns refresh whenever the owner opens their wallet.

That is a real mitigation, and it is why this was Low. But it means the mirror
is only as fresh as the last time somebody looked — a business whose payouts
Stripe just disabled keeps reading "payouts enabled" until they next open the
screen, which is exactly when they would rather have already been told.
"""

from unittest.mock import MagicMock, patch

from app.api import payments_stripe


def _account(**over):
    payload = {
        "id": "acct_123",
        "payouts_enabled": False,
        "charges_enabled": True,
        "details_submitted": True,
        "requirements": {
            "disabled_reason": "requirements.past_due",
            "currently_due": ["individual.verification.document"],
        },
    }
    payload.update(over)
    return payload


class TestAccountUpdated:
    def test_it_mirrors_onto_the_matching_business(self):
        supabase = MagicMock()
        chain = (
            supabase.table.return_value.select.return_value.eq.return_value.limit.return_value
        )
        chain.execute.return_value = MagicMock(data=[{"id": "biz-1"}])

        with patch.object(payments_stripe, "supabase", supabase), patch(
            "app.api.payouts._mirror_account_state"
        ) as mirror:
            payments_stripe._dispatch_webhook_event("account.updated", _account())

        mirror.assert_called_once()
        business_id, status = mirror.call_args[0]
        assert business_id == "biz-1"
        assert status["payouts_enabled"] is False
        assert status["disabled_reason"] == "requirements.past_due"
        assert status["requirements_due"] == ["individual.verification.document"]

    def test_an_unknown_connect_account_is_not_an_error(self):
        """Normal in a shared Stripe test account — must not 500 the webhook."""
        supabase = MagicMock()
        chain = (
            supabase.table.return_value.select.return_value.eq.return_value.limit.return_value
        )
        chain.execute.return_value = MagicMock(data=[])

        with patch.object(payments_stripe, "supabase", supabase), patch(
            "app.api.payouts._mirror_account_state"
        ) as mirror:
            payments_stripe._dispatch_webhook_event("account.updated", _account())

        mirror.assert_not_called()

    def test_a_mirror_failure_does_not_fail_the_webhook(self):
        """
        Raising would make Stripe retry an event whose only job was to save a
        round-trip, while reconcile-on-read still covers the data.
        """
        supabase = MagicMock()
        supabase.table.side_effect = RuntimeError("PostgREST down")

        with patch.object(payments_stripe, "supabase", supabase):
            payments_stripe._dispatch_webhook_event("account.updated", _account())

    def test_payout_and_transfer_events_stay_unhandled_on_purpose(self):
        """
        They report money movement this system already records in `payments`.
        A second, differently-shaped record of the same event is how two ledgers
        start disagreeing — reconciling them is a design decision, not a missing
        handler, so the deliberate no-op is pinned here rather than left to look
        like an oversight.
        """
        with patch.object(payments_stripe, "supabase", MagicMock()):
            for etype in ("payout.paid", "payout.failed", "transfer.created"):
                payments_stripe._dispatch_webhook_event(etype, {"id": "x"})
