"""
test_message_rate_limit.py — SB-0018: pentest M-02's fix was the only one with
no regression test.

M-02 was "no rate limit on POST /messages/" — the report recorded 110 of 110
messages accepted with zero 429s. The fix (D7.6) added `@limiter.limit(
"60/minute")`, and it is correct: the decorator order puts `@router.post("/")`
outside and the limit inside, and `request: Request` is in the signature, which
slowapi requires or the limit silently becomes a no-op.

But nothing pinned it. `test_pentest_mediums.py` covers M-01, M-03, M-04 and
M-05; C-01 has `test_session_security.py`; L-03 has its handler block. Deleting
the `@limiter.limit` line, or reordering the two decorators so slowapi never
sees the request, passed the entire suite.

Both of those regressions are asserted here — the behaviour, and the two
structural facts that make the behaviour possible. The structural ones matter
because the silent-no-op failure mode (dropping `request: Request`) leaves the
decorator visibly present while doing nothing at all.
"""

import inspect

from fastapi.testclient import TestClient

from app.api import messages as messages_module
from app.deps import get_current_user
from app.main import app

SENDER = {"id": "22222222-2222-2222-2222-222222222222", "role": "client"}


class TestMessagesAreRateLimited:
    def test_the_61st_message_in_a_minute_is_refused(self):
        """
        The report's own shape: keep posting and a 429 must eventually arrive.
        The request fails long before Supabase (no such booking), which is
        fine — the limiter runs inside the handler, so a 429 still proves the
        budget is enforced.
        """
        app.dependency_overrides[get_current_user] = lambda: SENDER
        app.state.limiter.reset()
        try:
            # raise_server_exceptions=False: the handler reaches Supabase
            # (unreachable under test) and raises, which TestClient would
            # re-raise instead of returning a response. We only care that the
            # limiter counted the attempt.
            with TestClient(app, raise_server_exceptions=False) as client:
                saw_429 = False
                for _ in range(70):
                    resp = client.post(
                        "/messages/",
                        json={
                            "booking_id": "00000000-0000-0000-0000-000000000000",
                            "message_type": "text",
                            "content": "hello",
                        },
                    )
                    if resp.status_code == 429:
                        saw_429 = True
                        break
            assert saw_429, (
                "POST /messages/ accepted 70 messages without a 429 — pentest "
                "M-02 has regressed (SB-0018)"
            )
        finally:
            app.state.limiter.reset()
            app.dependency_overrides.pop(get_current_user, None)


class TestTheLimitCannotSilentlyBecomeANoOp:
    """
    slowapi needs both of these. Lose either and the decorator stays in the
    source, looking enforced, while counting nothing.
    """

    def test_handler_still_takes_request(self):
        params = inspect.signature(messages_module.send_message).parameters
        assert "request" in params, (
            "slowapi resolves the limiter key from `request`; without it in the "
            "signature the @limiter.limit decorator is a silent no-op"
        )

    def test_the_route_declares_a_limit(self):
        src = inspect.getsource(messages_module)
        marker = src.find("def send_message")
        assert marker != -1
        # The decorators sit immediately above the function.
        head = src[max(0, marker - 600) : marker]
        assert (
            "@limiter.limit(" in head
        ), "POST /messages/ no longer declares a rate limit (pentest M-02)"
