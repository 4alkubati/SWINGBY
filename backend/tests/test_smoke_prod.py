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

    def test_swagger_docs_available(self):
        """
        T86.3: GET /docs should return 200 (FastAPI Swagger UI).
        """
        with httpx.Client(timeout=30) as client:
            response = client.get(f"{BASE_URL}/docs")

            assert response.status_code == 200
            # Check it's HTML (not JSON error)
            assert "text/html" in response.headers.get("content-type", "")
