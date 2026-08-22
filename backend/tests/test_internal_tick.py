"""POST /internal/tick — the external ticker for a deployment with no scheduler.

Settlement here is lazy: the 24h approval auto-release and the expired-post
refund both run when somebody loads a screen. That is correct, and it is not a
guarantee that money moves on time — the party owed money is the one least able
to make someone open the app. This endpoint lets the existing 10-minute
keep-warm cron drive both sweeps.
"""

from unittest.mock import patch

import pytest

from app.config import settings


@pytest.fixture
def tick_on(monkeypatch):
    monkeypatch.setenv("TICK_TOKEN", "s3cret-tick")
    assert settings.TICK_TOKEN == "s3cret-tick"


class TestItIsOffUntilConfigured:
    def test_unset_token_404s_rather_than_403s(self, test_client, monkeypatch):
        """404, not 403: an unconfigured deployment must not confirm the route
        exists."""
        monkeypatch.delenv("TICK_TOKEN", raising=False)
        r = test_client.post("/internal/tick")
        assert r.status_code == 404

    def test_no_sweep_runs_when_it_is_off(self, test_client, monkeypatch):
        monkeypatch.delenv("TICK_TOKEN", raising=False)
        with patch("app.services.approvals.settle_due") as settle:
            test_client.post("/internal/tick")
        settle.assert_not_called()


class TestTheToken:
    def test_a_wrong_token_is_refused(self, test_client, tick_on):
        with patch("app.services.approvals.settle_due") as settle:
            r = test_client.post("/internal/tick", headers={"X-Tick-Token": "wrong"})
        assert r.status_code == 403
        settle.assert_not_called()

    def test_a_missing_header_is_refused(self, test_client, tick_on):
        assert test_client.post("/internal/tick").status_code == 403

    def test_the_right_token_runs_both_sweeps(self, test_client, tick_on):
        with patch(
            "app.services.approvals.settle_due",
            return_value={"checked": 3, "released": 1, "skipped": 2},
        ), patch(
            "app.services.expiry_sweep.sweep_once",
            return_value={"refunded": 2, "failed": 0},
        ):
            r = test_client.post(
                "/internal/tick", headers={"X-Tick-Token": "s3cret-tick"}
            )
        assert r.status_code == 200
        body = r.json()
        assert body["approvals"]["released"] == 1
        assert body["post_expiry"]["refunded"] == 2


class TestOneFailureDoesNotStopTheOther:
    """They settle different money for different people, and this endpoint
    exists precisely for when nobody is watching."""

    def test_a_failing_approval_sweep_still_lets_expiry_run(self, test_client, tick_on):
        with patch(
            "app.services.approvals.settle_due", side_effect=RuntimeError("boom")
        ), patch(
            "app.services.expiry_sweep.sweep_once",
            return_value={"refunded": 1, "failed": 0},
        ):
            r = test_client.post(
                "/internal/tick", headers={"X-Tick-Token": "s3cret-tick"}
            )
        assert r.status_code == 200
        assert r.json()["approvals"] == {"error": "failed"}
        assert r.json()["post_expiry"]["refunded"] == 1

    def test_a_failing_expiry_sweep_still_reports_the_releases(
        self, test_client, tick_on
    ):
        with patch(
            "app.services.approvals.settle_due",
            return_value={"checked": 1, "released": 1, "skipped": 0},
        ), patch(
            "app.services.expiry_sweep.sweep_once", side_effect=RuntimeError("boom")
        ):
            r = test_client.post(
                "/internal/tick", headers={"X-Tick-Token": "s3cret-tick"}
            )
        assert r.status_code == 200
        assert r.json()["approvals"]["released"] == 1
        assert r.json()["post_expiry"] == {"error": "failed"}
