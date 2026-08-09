"""
test_unknown_path_404.py — Bug 9 (walkthrough device pass).

An unknown path under a mounted router was surfacing as 500, not 404. Several
`/bookings/{booking_id}/...` handlers query Postgres straight off the raw path
segment with no try/except (app/api/invoices.py, booking_location.py,
payments_stripe.py, proof_of_work.py). `booking_id` is typed `str`, not UUID,
so FastAPI happily routes a garbage segment like
`/bookings/definitely-not-a-route/invoice` into the handler; Postgres then
rejects the WHERE clause with code 22P02 (invalid_text_representation) and,
unguarded, that becomes an unhandled 500 instead of the 404 it actually is.

Fix: a single global exception handler in app/main.py keyed on APIError code
22P02 — not on APIError broadly, so a genuine server failure (a different
Postgrest error, a real query bug) still 500s exactly like it did before.

These tests cover both the isolated handler logic and one real end-to-end
route (GET /bookings/{id}/invoice) so a regression in either layer is caught.
"""

import asyncio
from unittest.mock import MagicMock, patch

import pytest
from postgrest.exceptions import APIError

from app.deps import get_current_user
from app.main import _postgrest_bad_identifier_to_404, app

CLIENT = {"id": "client-1", "role": "client", "first_name": "Casey"}


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _clear():
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_client():
    _override(CLIENT)
    yield CLIENT
    _clear()


def _api_error(code: str) -> APIError:
    return APIError(
        {
            "message": f'invalid input syntax for type uuid: "definitely-not-a-route"'
            if code == "22P02"
            else "some other postgrest failure",
            "code": code,
            "hint": None,
            "details": None,
        }
    )


# ---------------------------------------------------------------------------
# Unit tests on the handler itself — independent of which route triggers it.
# ---------------------------------------------------------------------------


def test_invalid_uuid_cast_becomes_404():
    exc = _api_error("22P02")
    response = asyncio.run(
        _postgrest_bad_identifier_to_404(request=MagicMock(), exc=exc)
    )
    assert response.status_code == 404
    assert response.body == b'{"detail":"Not Found"}'


def test_other_postgrest_error_codes_are_not_swallowed():
    """
    A different Postgrest failure (RLS denial, real query bug, connection
    issue) must NOT be reinterpreted as 404 — that would turn genuine 500s
    into false negatives, which is explicitly the failure mode to avoid here.
    """
    exc = _api_error("42501")  # insufficient_privilege, e.g. an RLS denial
    with pytest.raises(APIError):
        asyncio.run(_postgrest_bad_identifier_to_404(request=MagicMock(), exc=exc))


# ---------------------------------------------------------------------------
# End-to-end: a real affected route, GET /bookings/{booking_id}/invoice,
# whose first Supabase call (app/api/invoices.py::_load_invoice_data) is
# unguarded and is exactly what reproduced the bug on-device.
# ---------------------------------------------------------------------------


def test_garbage_booking_id_on_invoice_route_is_404_not_500(as_client, test_client):
    with patch("app.api.invoices.supabase") as mock_supabase:
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = _api_error(
            "22P02"
        )
        resp = test_client.get("/bookings/definitely-not-a-route/invoice")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "Not Found"}


def test_real_server_error_on_invoice_route_still_500s(as_client):
    """
    Same route, but the Postgrest failure is NOT the invalid-UUID code — this
    must still surface as an unhandled 500, proving the fix didn't turn into
    a blanket try/except that hides real backend failures.
    """
    from fastapi.testclient import TestClient

    strict_client = TestClient(app, raise_server_exceptions=False)
    with patch("app.api.invoices.supabase") as mock_supabase:
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = _api_error(
            "42501"
        )
        resp = strict_client.get("/bookings/33333333-3333-3333-3333-333333333333/invoice")
    assert resp.status_code == 500
