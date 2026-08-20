"""
test_deploy_surface.py — SB-0021 / SB-0022 / SB-0045: three ways the deployed
API misrepresents itself to the things that depend on it.

SB-0021 — the production CORS allowlist unconditionally contained
`http://localhost:5173` and `http://localhost:3000`, combined with
`allow_credentials=True`. That grants credentialed cross-origin reads to
anything served from localhost on a user's machine: any local dev server,
Electron app, or locally-installed tool. The docs/health gating a few lines
above it is guarded by `IS_PRODUCTION`; these two defaults never were.

SB-0022 — 429 bodies came from slowapi's stock handler and used an `error` key
while every other error on the API uses `detail`. A client reading
`err.response.data.detail` renders an empty message at exactly the moment the
user most needs to be told what happened, and the stock body also echoes the
configured limit string back to the caller.

SB-0045 — `/healthz` is Render's `healthCheckPath`, and it was
`return {"status": "ok"}` with no dependency check at all. It cannot fail, so a
deploy with broken Supabase credentials is promoted as healthy. `/health` does
probe the database, but it answers 200 either way, so pointing Render at it
instead would not have helped.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app


@pytest.fixture
def client():
    app.state.limiter.reset()
    with TestClient(app) as c:
        yield c
    app.state.limiter.reset()


class TestCorsIsNotOpenToLocalhostInProduction:
    def test_localhost_defaults_are_environment_gated(self, monkeypatch):
        """
        The defaults must exist on a dev box and NOT in production. Driven
        through ENV — the same variable IS_PRODUCTION reads — rather than by
        patching the property, so the test exercises the real mechanism.
        """
        assert hasattr(main_module, "build_allowed_origins"), (
            "expected a build_allowed_origins() so the localhost defaults can "
            "be gated on IS_PRODUCTION (SB-0021)"
        )
        monkeypatch.setenv("ENV", "production")
        prod = main_module.build_allowed_origins()
        assert not [
            o for o in prod if "localhost" in o
        ], f"production CORS allowlist still contains localhost: {prod}"

    def test_dev_still_gets_the_localhost_defaults(self, monkeypatch):
        """A fix that breaks every local web dev loop is not a fix."""
        monkeypatch.setenv("ENV", "development")
        dev = main_module.build_allowed_origins()
        assert "http://localhost:5173" in dev
        assert "http://localhost:3000" in dev

    def test_wildcard_filtering_survives(self, monkeypatch):
        """The checklist-#8 guard must not be lost in the rewrite."""
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("SWINGBY_ALLOWED_ORIGINS", "https://swingbyy.com,*")
        origins = main_module.build_allowed_origins()
        assert "*" not in origins
        assert "https://swingbyy.com" in origins


class TestRateLimitBodyMatchesEveryOtherError:
    def test_429_uses_detail_not_error(self, client):
        """
        Trip a documented limit and read the body. Every other error on this
        API is {"detail": ...}; a 429 that says {"error": ...} renders blank in
        the clients.
        """
        last = None
        for _ in range(40):
            last = client.post(
                "/auth/forgot-password", json={"email": "nobody@example.com"}
            )
            if last.status_code == 429:
                break
        assert (
            last is not None and last.status_code == 429
        ), "could not trip a rate limit to inspect the 429 body"
        body = last.json()
        assert "detail" in body, f"429 body has no `detail` key: {body}"
        assert "error" not in body, f"429 body still uses the `error` key: {body}"

    def test_429_does_not_echo_the_configured_limit(self, client):
        last = None
        for _ in range(40):
            last = client.post(
                "/auth/forgot-password", json={"email": "nobody@example.com"}
            )
            if last.status_code == 429:
                break
        assert last is not None and last.status_code == 429
        text = str(last.json())
        assert (
            "per 1 minute" not in text
        ), "the 429 body echoes the configured limit string back to the caller"


class TestHealthzCanActuallyFail:
    """
    Render promotes a deploy when healthCheckPath answers 200. A probe that
    cannot fail turns that gate into decoration.
    """

    def test_healthz_reports_503_when_the_database_is_unreachable(self, client):
        with patch("app.supabase_client.supabase") as fake:
            fake.table.side_effect = RuntimeError("PostgREST unreachable")
            resp = client.get("/healthz")
        assert resp.status_code == 503, (
            "/healthz answered 200 with a dead database — a deploy with broken "
            "Supabase credentials would be promoted as healthy (SB-0045)"
        )

    def test_healthz_is_200_when_healthy(self, client):
        with patch("app.supabase_client.supabase") as fake:
            fake.table.return_value.select.return_value.limit.return_value.execute.return_value = (
                None
            )
            resp = client.get("/healthz")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_healthz_stays_quiet_about_internals(self):
        """
        It is an unauthenticated probe. It may say up or down and nothing else —
        no exception text, no host names, no key states.
        """
        import inspect

        src = inspect.getsource(main_module.healthz)
        for leak in ("str(exc", "repr(", "traceback", "SUPABASE_URL"):
            assert leak not in src, f"/healthz leaks internals via {leak}"


class TestCaptchaIsNotAOneWaySwitch:
    """
    SB-0046 — setting HCAPTCHA_SECRET alone used to refuse 100% of signups.

    No client sends `hcaptcha_token` — not the mobile app, not either web app —
    so the first person to paste the secret into the Render dashboard would
    have taken signup down, with a 429 that names a captcha nobody rendered.
    """

    def test_secret_alone_does_not_refuse_signups(self, monkeypatch):
        import app.config as config_module

        monkeypatch.setenv("HCAPTCHA_SECRET", "0x-secret")
        monkeypatch.delenv("HCAPTCHA_ENFORCE", raising=False)
        assert config_module.settings.HCAPTCHA_SECRET
        assert (
            not config_module.settings.HCAPTCHA_ENFORCE
        ), "configuring the secret must not by itself start refusing signups"

    def test_enforcement_is_a_second_deliberate_switch(self, monkeypatch):
        import app.config as config_module

        monkeypatch.setenv("HCAPTCHA_SECRET", "0x-secret")
        monkeypatch.setenv("HCAPTCHA_ENFORCE", "1")
        assert config_module.settings.HCAPTCHA_ENFORCE

    def test_the_guard_reads_both(self):
        """Both conditions must appear together, or the trap is back."""
        import inspect

        from app.api import auth

        src = inspect.getsource(auth.signup)
        assert (
            "HCAPTCHA_ENFORCE" in src
        ), "signup refuses on HCAPTCHA_SECRET alone again (SB-0046)"
