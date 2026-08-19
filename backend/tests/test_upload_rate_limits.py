"""
test_upload_rate_limits.py — SB-0012: the uploads are an unmetered write path
into paid storage, and `default_limits` was a control that did not exist.

`limiter.py` declared `default_limits=["100/minute"]`, which reads like a global
ceiling on every route. slowapi only applies `default_limits` to undecorated
routes when `SlowAPIMiddleware` is registered on the app, and it never was —
`main.py` only sets `app.state.limiter` plus the RateLimitExceeded handler,
which is what makes the per-route `@limiter.limit(...)` decorators work and
nothing more. Confirmed live at the time of filing: 150 requests to an
undecorated route produced zero 429s.

The load-bearing consequence is the uploads. `POST /uploads/image` (10 MB cap,
public `job-photos` bucket) and `POST /uploads/audio` (8 MB, private
`voice-notes` bucket) took unlimited requests from any authenticated account —
a metered, billable write path with nothing in front of it.

Why the fix is explicit decorators rather than registering the middleware:
turning `default_limits` on globally would impose 100/min on every route at
once, including the list views the mobile app polls. Choosing a global number
for a live app by guessing is a bigger risk than the hole being closed. So the
claim that was never true is deleted, and the routes that actually needed a
limit get one they declare out loud.
"""

import io
import os

import pytest
from fastapi.testclient import TestClient

from app.deps import get_current_user
from app.main import app


REPO_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

UPLOADER = {"id": "11111111-1111-1111-1111-111111111111", "role": "client"}


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: UPLOADER
    app.state.limiter.reset()
    with TestClient(app) as c:
        yield c
    app.state.limiter.reset()
    app.dependency_overrides.pop(get_current_user, None)


class TestUploadsAreMetered:
    """
    Both routes must refuse eventually. The request is rejected long before it
    reaches Supabase (an unreadable content type 400s), which is fine — the
    limiter runs first, so a 429 still proves the decorator is wired.
    """

    def _spam(self, client, path, filename, content_type, attempts=45):
        seen = set()
        for _ in range(attempts):
            resp = client.post(
                path,
                files={"file": (filename, io.BytesIO(b"not-a-real-media-file"), content_type)},
            )
            seen.add(resp.status_code)
            if resp.status_code == 429:
                break
        return seen

    def test_image_upload_is_rate_limited(self, client):
        seen = self._spam(client, "/uploads/image", "x.jpg", "image/jpeg")
        assert 429 in seen, (
            "POST /uploads/image accepted every request — an unmetered write "
            "path into the paid public job-photos bucket (SB-0012)"
        )

    def test_audio_upload_is_rate_limited(self, client):
        seen = self._spam(client, "/uploads/audio", "x.m4a", "audio/m4a")
        assert 429 in seen, (
            "POST /uploads/audio accepted every request — an unmetered write "
            "path into the paid private voice-notes bucket (SB-0012)"
        )


class TestNoPhantomGlobalLimit:
    def test_limiter_does_not_claim_a_default_it_cannot_enforce(self):
        """
        `default_limits` without `SlowAPIMiddleware` is inert. Either the
        middleware is registered so the default really applies, or the claim is
        removed — what must not survive is a declared ceiling that enforces
        nothing, because the next reader will trust it.
        """
        limiter_src = open(os.path.join(REPO_BACKEND, "app", "limiter.py")).read()
        app_dir = os.path.join(REPO_BACKEND, "app")
        registered = any(
            "SlowAPIMiddleware" in open(os.path.join(root, name), encoding="utf-8").read()
            for root, _, names in os.walk(app_dir)
            for name in names
            if name.endswith(".py")
        )
        if not registered:
            assert "default_limits" not in limiter_src, (
                "limiter.py declares default_limits but no SlowAPIMiddleware is "
                "registered, so it applies to nothing (SB-0012)"
            )
