"""
test_geocoding.py — RO-0 server-side geocoding fallback.

The bug being guarded: every service post created before 2026-07-19 has NULL
lat/lng, because the only writer was a mobile branch gated on an env var that
was never set. These tests pin the fallback's contract — especially that it
never raises and never invents coordinates, since a post that fails to geocode
must still be a valid post.
"""

import pytest

from app.services import geocoding
from app.services.geocoding import geocode_address, resolve_coordinates


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


def _ok_payload(lat=51.0447, lng=-114.0719):
    return {
        "status": "OK",
        "results": [{"geometry": {"location": {"lat": lat, "lng": lng}}}],
    }


@pytest.fixture
def with_key(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")


# ── geocode_address ───────────────────────────────────────────────────────────


def test_returns_coordinates_on_success(monkeypatch, with_key):
    monkeypatch.setattr(
        geocoding.httpx, "get", lambda *a, **k: _FakeResponse(_ok_payload())
    )
    assert geocode_address("123 Main St, Calgary") == (51.0447, -114.0719)


def test_no_key_returns_none_without_calling_out(monkeypatch):
    monkeypatch.delenv("GOOGLE_MAPS_API_KEY", raising=False)

    def explode(*a, **k):
        raise AssertionError("must not call the API without a key")

    monkeypatch.setattr(geocoding.httpx, "get", explode)
    assert geocode_address("123 Main St") is None


@pytest.mark.parametrize("address", [None, "", "   "])
def test_empty_address_short_circuits(address, with_key):
    assert geocode_address(address) is None


def test_network_failure_is_swallowed(monkeypatch, with_key):
    def boom(*a, **k):
        raise ConnectionError("network down")

    monkeypatch.setattr(geocoding.httpx, "get", boom)
    # Must not propagate: a geocoding outage cannot take down post creation.
    assert geocode_address("123 Main St") is None


def test_zero_results_returns_none(monkeypatch, with_key):
    monkeypatch.setattr(
        geocoding.httpx,
        "get",
        lambda *a, **k: _FakeResponse({"status": "ZERO_RESULTS", "results": []}),
    )
    assert geocode_address("nowhere at all") is None


def test_request_denied_returns_none(monkeypatch, with_key):
    monkeypatch.setattr(
        geocoding.httpx,
        "get",
        lambda *a, **k: _FakeResponse({"status": "REQUEST_DENIED"}),
    )
    assert geocode_address("123 Main St") is None


def test_malformed_payload_returns_none(monkeypatch, with_key):
    monkeypatch.setattr(
        geocoding.httpx,
        "get",
        lambda *a, **k: _FakeResponse({"status": "OK", "results": [{}]}),
    )
    assert geocode_address("123 Main St") is None


def test_out_of_range_coordinates_rejected(monkeypatch, with_key):
    monkeypatch.setattr(
        geocoding.httpx,
        "get",
        lambda *a, **k: _FakeResponse(_ok_payload(lat=999.0, lng=0.0)),
    )
    assert geocode_address("123 Main St") is None


# ── resolve_coordinates ───────────────────────────────────────────────────────


def test_supplied_coordinates_win_without_an_api_call(monkeypatch, with_key):
    def explode(*a, **k):
        raise AssertionError("must not geocode when coordinates were supplied")

    monkeypatch.setattr(geocoding.httpx, "get", explode)
    assert resolve_coordinates(51.05, -114.07, "123 Main St") == {
        "lat": 51.05,
        "lng": -114.07,
    }


def test_missing_coordinates_are_resolved_from_address(monkeypatch, with_key):
    monkeypatch.setattr(
        geocoding.httpx, "get", lambda *a, **k: _FakeResponse(_ok_payload())
    )
    assert resolve_coordinates(None, None, "123 Main St") == {
        "lat": 51.0447,
        "lng": -114.0719,
    }


def test_unresolvable_address_leaves_coordinates_null(monkeypatch, with_key):
    monkeypatch.setattr(
        geocoding.httpx,
        "get",
        lambda *a, **k: _FakeResponse({"status": "ZERO_RESULTS", "results": []}),
    )
    assert resolve_coordinates(None, None, "gibberish") == {"lat": None, "lng": None}


def test_no_address_is_a_noop(with_key):
    assert resolve_coordinates(None, None, None) == {"lat": None, "lng": None}


def test_never_returns_provenance_columns(monkeypatch, with_key):
    """
    Guards the Jul 17 outage shape: docs/geocoding_columns.sql is FILED but not
    applied, so the request path must never write geocode_source/geocoded_at —
    doing so would fail every insert until the migration lands.
    """
    monkeypatch.setattr(
        geocoding.httpx, "get", lambda *a, **k: _FakeResponse(_ok_payload())
    )
    for result in (
        resolve_coordinates(None, None, "123 Main St"),
        resolve_coordinates(51.05, -114.07, "123 Main St"),
        resolve_coordinates(None, None, None),
    ):
        assert set(result) == {"lat", "lng"}
