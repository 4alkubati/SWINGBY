"""/health must report BOTH Stripe keys, not just the secret one.

WHY THIS EXISTS
---------------
2026-07-26: Sentry showed `native_sheet_unavailable: STRIPE_PUBLISHABLE_KEY is
not set` on live payment traffic while `GET /health` was answering
`{"stripe": "ok"}`. Both were true. The health check read only
STRIPE_SECRET_KEY, which powers server-side charges; the native Payment Sheet
runs off STRIPE_PUBLISHABLE_KEY, which nothing here looked at. A health check
that covers one of two required keys reports health it has not measured.

The same issue also revealed that Sentry's `environment` comes from
`os.getenv("ENV", "development")` and Render sets no ENV, so production had
been tagging its own errors "development" — which is why the report looked
like it came from a laptop. /health now states the environment it believes it
is in, so that mislabelling is visible from outside the box.
"""

import pytest
from fastapi.testclient import TestClient

from app.config import stripe_publishable_diagnosis


def _get(client):
    return client.get("/health").json()


@pytest.fixture
def client():
    from app.main import app

    return TestClient(app)


class TestPublishableKeyDiagnosis:
    def test_absent_key_is_not_configured(self, monkeypatch):
        monkeypatch.delenv("STRIPE_PUBLISHABLE_KEY", raising=False)
        assert stripe_publishable_diagnosis() == {"state": "not_configured"}

    def test_a_good_test_key_is_ok(self, monkeypatch):
        monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_51AbCdEf0123456789")
        assert stripe_publishable_diagnosis()["state"] == "ok"

    def test_surrounding_whitespace_is_tolerated(self, monkeypatch):
        monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "  pk_live_51AbCdEf0123456789\n")
        assert stripe_publishable_diagnosis()["state"] == "ok"

    def test_the_masked_paste_is_caught(self, monkeypatch):
        # The SEN-1 failure shape: a dashboard preview copied with its ellipsis.
        monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_51AbC…")
        d = stripe_publishable_diagnosis()
        assert d["state"] == "malformed"
        assert d["problem"] == "non_ascii_character"

    def test_a_secret_key_in_the_publishable_slot_is_caught(self, monkeypatch):
        # The dangerous inversion — this value ships to every phone.
        monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "sk_test_51AbCdEf0123456789")
        d = stripe_publishable_diagnosis()
        assert d["state"] == "malformed"
        assert d["problem"] == "secret_key_not_publishable_key"

    def test_never_leaks_the_value(self, monkeypatch):
        secret = "pk_test_51SuperSecretValue"
        monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", secret)
        assert secret not in repr(stripe_publishable_diagnosis())


class TestHealthEndpoint:
    def test_health_reports_the_publishable_key_separately(self, monkeypatch, client):
        monkeypatch.delenv("STRIPE_PUBLISHABLE_KEY", raising=False)
        body = _get(client)
        # The exact regression: secret key fine, sheet dead, health silent.
        assert body["stripe_publishable"] == "not_configured"

    def test_a_configured_publishable_key_reads_ok(self, monkeypatch, client):
        monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_51AbCdEf0123456789")
        assert _get(client)["stripe_publishable"] == "ok"

    def test_health_states_which_environment_it_thinks_it_is(self, monkeypatch, client):
        monkeypatch.delenv("ENV", raising=False)
        # Unset ENV is exactly Render's situation: prod calling itself dev.
        assert _get(client)["environment"] == "development"

        monkeypatch.setenv("ENV", "production")
        assert _get(client)["environment"] == "production"

    def test_health_never_leaks_either_key(self, monkeypatch, client):
        monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_51PublishableSecret")
        monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_51TheActualSecret")
        raw = client.get("/health").text
        assert "51PublishableSecret" not in raw
        assert "51TheActualSecret" not in raw
