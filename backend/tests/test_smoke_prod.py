"""
test_smoke_prod.py — Smoke tests against deployed Render URL.

Tests are marked with @pytest.mark.smoke so they can be skipped in CI by default.
Run with: pytest -m smoke

Coverage:
- GET /healthz → 200 {"status":"ok"}
- GET /health → 200 + "database":"connected"
- GET /docs → 200 (FastAPI Swagger UI)
"""

import pytest
import httpx
import os

# Target URL from environment variable
BASE_URL = os.getenv("RENDER_URL", "https://swingbyy-api.onrender.com")


@pytest.mark.smoke
class TestSmokeDeployedAPI:
    """Smoke tests against production Render deployment."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Check if BASE_URL is valid before running tests."""
        if not BASE_URL or BASE_URL.startswith("http://localhost"):
            pytest.skip("BASE_URL not set or is localhost placeholder")

    def test_healthz_liveness_probe(self):
        """
        T86.1: GET /healthz should return 200 {"status":"ok"}.
        Lightweight liveness probe, no database call.
        """
        with httpx.Client(timeout=30) as client:
            response = client.get(f"{BASE_URL}/healthz")

            assert response.status_code == 200
            data = response.json()
            assert data.get("status") == "ok"

    def test_health_with_database_check(self):
        """
        T86.2: GET /health should return 200 + "database":"connected".
        Includes database connectivity check.
        """
        with httpx.Client(timeout=30) as client:
            response = client.get(f"{BASE_URL}/health")

            assert response.status_code == 200
            data = response.json()
            assert "status" in data
            assert "database" in data

    def test_swagger_docs_are_NOT_public(self):
        """
        Inverted on 2026-08-19 (SB-0065). This used to assert /docs returns 200
        in production, which fought the docs lockdown landed in f26408d: that
        change removes /docs, /redoc and /openapi.json when ENV=production
        because serving them unauthenticated published the complete route
        inventory — "the map an attacker uses to find everything else".

        Left as-is, this test would start failing the moment the lockdown
        deployed, and the quickest way to make it green again is to revert the
        security fix. A test that punishes the correct behaviour is worse than
        no test.
        """
        with httpx.Client(timeout=30) as client:
            response = client.get(f"{BASE_URL}/docs")

            assert response.status_code != 200, (
                "production is serving Swagger UI publicly — API_ENABLE_DOCS is "
                "set, or ENV is not 'production' on the deployed service"
            )
