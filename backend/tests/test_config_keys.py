"""Supabase key names, and a /health probe that watches the right database.

Two launch-day failures, both found on 2026-07-31 by trying to start the
backend from a fresh clone with the repo's own .env — and failing.
"""

import importlib
import os
from unittest.mock import patch

import pytest


def _reload_config(env):
    """Re-import app.config under `env` and resolve the keys while it is live.

    `settings.*` reads os.environ at ACCESS time, so the values have to be read
    inside the patch — returning the module and reading it afterwards just
    reports the ambient test environment.
    """
    with patch.dict(os.environ, env, clear=True):
        import app.config as config

        reloaded = importlib.reload(config)
        return {
            "service_key": reloaded.settings.SUPABASE_SERVICE_KEY,
            "anon_key": reloaded.settings.SUPABASE_KEY,
            "required": list(reloaded._REQUIRED),
        }


BASE = {
    "SUPABASE_URL": "https://x.supabase.co",
    "SECRET_KEY": "s",
}


class TestBothSupabaseKeyGenerations:
    """Supabase replaced anon/service_role with sb_publishable_/sb_secret_.

    config.py knew only the old names and raises at IMPORT, so the day the
    legacy keys are switched off the process does not degrade — it refuses to
    boot, and Render restarts into the same crash forever.

    Verified 2026-07-31 that the new secret key is a drop-in: mapped onto the
    old name it booted the app and POST /auth/login returned 200 against the
    live project. Only the NAME differed.
    """

    def test_legacy_name_still_works(self):
        cfg = _reload_config({**BASE, "SUPABASE_SERVICE_KEY": "legacy-service"})
        assert cfg["service_key"] == "legacy-service"

    def test_modern_name_is_accepted(self):
        cfg = _reload_config({**BASE, "SUPABASE_SECRET_KEY": "sb_secret_abc"})
        assert cfg["service_key"] == "sb_secret_abc"

    def test_publishable_name_is_accepted(self):
        cfg = _reload_config(
            {
                **BASE,
                "SUPABASE_SERVICE_KEY": "legacy",
                "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_abc",
            }
        )
        assert cfg["anon_key"] == "sb_publishable_abc"

    def test_an_explicit_legacy_value_wins(self):
        # Nothing may change for an environment that already works today.
        cfg = _reload_config(
            {
                **BASE,
                "SUPABASE_SERVICE_KEY": "legacy-wins",
                "SUPABASE_SECRET_KEY": "sb_secret_ignored",
            }
        )
        assert cfg["service_key"] == "legacy-wins"

    def test_neither_name_is_still_a_hard_failure(self):
        # Booting with no key at all would 500 every request instead.
        with pytest.raises(RuntimeError) as exc:
            _reload_config(BASE)
        assert "SUPABASE_SERVICE_KEY" in str(exc.value)
        # …and it must mention the modern name, or the next person retries the
        # same wrong variable.
        assert "SUPABASE_SECRET_KEY" in str(exc.value)


class TestDatabaseUrlIsNotRequired:
    """Nothing in this app queries Postgres directly — every read and write
    goes through PostgREST. Requiring a connection string the app never opens
    meant a correctly-configured deployment could refuse to start."""

    def test_boots_without_database_url(self):
        cfg = _reload_config({**BASE, "SUPABASE_SERVICE_KEY": "k"})
        assert "DATABASE_URL" not in cfg["required"]

    def test_engine_is_none_rather_than_exploding(self):
        import app.database as database

        with patch.dict(os.environ, {**BASE, "SUPABASE_SERVICE_KEY": "k"}, clear=True):
            reloaded = importlib.reload(database)
        assert reloaded.engine is None
        assert reloaded.SessionLocal is None

    def test_asking_for_a_session_explains_itself(self):
        import app.database as database

        with patch.dict(os.environ, {**BASE, "SUPABASE_SERVICE_KEY": "k"}, clear=True):
            reloaded = importlib.reload(database)
            with pytest.raises(RuntimeError, match="PostgREST"):
                next(reloaded.get_db())

        # Leave the module as the rest of the suite expects to find it.
        importlib.reload(database)


class TestHealthWatchesTheRightDatabase:
    """/health used to run `SELECT 1` through SQLAlchemy over DATABASE_URL — a
    connection with exactly ONE consumer in the codebase: that line.

    Every real query goes through PostgREST, so the probe answered a question
    nobody asked: green while PostgREST was down, red (as on the dev box, whose
    DATABASE_URL is empty) while the app was perfectly healthy. A launch-day
    dashboard built on it lies in both directions.
    """

    def test_health_probes_supabase_not_sqlalchemy(self, test_client):
        import app.main as main_api

        source = importlib.import_module("inspect").getsource(main_api.health_check)
        # Comments explain the old probe by name, so match on CODE only —
        # otherwise the docstring describing the fix fails the test for it.
        code = "\n".join(
            line for line in source.splitlines() if not line.strip().startswith("#")
        )
        assert "supabase.table" in code
        assert "engine.connect" not in code

    def test_ok_when_supabase_answers(self, test_client):
        with patch("app.supabase_client.supabase") as sb:
            sb.table.return_value.select.return_value.limit.return_value.execute.return_value = None
            res = test_client.get("/health")
        assert res.status_code == 200
        assert res.json()["database"] == "connected"

    def test_error_when_supabase_is_down(self, test_client):
        with patch("app.supabase_client.supabase") as sb:
            sb.table.side_effect = Exception("postgrest unreachable")
            res = test_client.get("/health")
        body = res.json()
        assert body["status"] == "error"
        assert body["detail"] == "Database unavailable"

    def test_direct_sql_is_reported_separately(self, test_client):
        # Absent is the normal, healthy state — it must not read as a fault.
        with patch("app.supabase_client.supabase") as sb:
            sb.table.return_value.select.return_value.limit.return_value.execute.return_value = None
            body = test_client.get("/health").json()
        assert body["direct_sql"] in ("configured", "not_configured")
        assert body["status"] == "ok"
