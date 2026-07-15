"""
conftest.py — Pytest fixtures for SwingBy backend tests.

Provides:
- test_client: FastAPI TestClient bound to app.main.app
- httpx_client: httpx.AsyncClient for async testing
- SupabaseTableStub: chain-agnostic stand-in for supabase.table(...) queries
- monkeypatch: injected by pytest for env var mocking
"""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from app.main import app


class SupabaseTableStub:
    """
    Stand-in for the object returned by supabase.table(name).

    Any query-builder chain (.select().eq().single()..., .insert()...,
    .update().eq()...) returns the stub itself; .execute() resolves to the
    data configured for the current mode. select/insert/update calls switch
    the mode so one stub can serve a lookup followed by a write.
    """

    def __init__(self, select_data=None, insert_data=None, update_data=None):
        self._data = {
            "select": select_data,
            "insert": insert_data,
            "update": update_data,
        }
        self._mode = "select"
        # Call recording — every chained method call, in order, as (name, args, kwargs).
        self.calls = []
        # Convenience: the most recent payload passed to .insert(...), so a
        # test can assert on what would have been written.
        self.inserted = None

    def __getattr__(self, name):
        if name == "execute":

            def _execute():
                self.calls.append(("execute", (), {}))
                data = self._data[self._mode]
                count = len(data) if isinstance(data, list) else None
                return SimpleNamespace(data=data, count=count)

            return _execute

        def _call(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            if name in ("select", "insert", "update", "upsert", "delete"):
                self._mode = name if name in self._data else self._mode
            if name == "insert" and args:
                self.inserted = args[0]
            return self

        return _call


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
