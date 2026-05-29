"""
conftest.py — Pytest fixtures for SwingBy backend tests.

Provides:
- test_client: FastAPI TestClient bound to app.main.app
- httpx_client: httpx.AsyncClient for async testing
- monkeypatch: injected by pytest for env var mocking
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def test_client():
    """
    Synchronous test client for FastAPI.
    Uses TestClient to run the app within the test process.
    """
    return TestClient(app)


@pytest.fixture
async def httpx_client():
    """
    Asynchronous test client using httpx.AsyncClient.
    Can be used with @pytest.mark.asyncio tests.
    """
    import httpx
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        yield client
