"""
test_analytics.py — CARD-23 GOAL 4 (audit K7 — no-analytics).

app.services.analytics.track_event() POSTs a minimal funnel event to PostHog's
capture endpoint (migrated off Plausible 2026-08-15; the public signature is
unchanged, so no call site moved). These tests pin the payload contract with a
mock so CI doesn't depend on network access, plus the two rules that matter
most: analytics failures must never surface to the caller or block the request
path, and nothing is sent at all without a project key — which is what keeps
local dev and CI off the network.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.services import analytics
from app.services.analytics import track_event


@pytest.fixture(autouse=True)
def _project_key():
    """Every test but the unset-key one needs a key present."""
    with patch.object(analytics, "POSTHOG_PROJECT_KEY", "phc_test"):
        yield


class TestTrackEventPayloadShape:
    def test_sends_key_event_and_synthesized_url(self):
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=200)
            track_event("Signup", url_path="/signup", props={"role": "client"})

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == analytics.POSTHOG_CAPTURE_URL
        body = kwargs["json"]
        assert body["api_key"] == "phc_test"
        assert body["event"] == "Signup"
        assert body["properties"]["role"] == "client"
        assert body["properties"]["$current_url"] == f"app://{analytics.APP_DOMAIN}/signup"
        assert body["properties"]["source"] == "backend"
        assert "User-Agent" in kwargs["headers"]

    def test_uses_the_given_distinct_id(self):
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=200)
            track_event("Booking Created", url_path="/booking/created", distinct_id="user-42")

        assert mock_post.call_args.kwargs["json"]["distinct_id"] == "user-42"

    def test_falls_back_to_an_anonymous_id_when_none_given(self):
        """Still recorded, but as its own person — the documented limitation
        that passing distinct_id at the call sites exists to remove."""
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=200)
            track_event("Booking Completed", url_path="/booking/completed")

        assert mock_post.call_args.kwargs["json"]["distinct_id"].startswith("anon-")

    def test_props_are_optional(self):
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=200)
            track_event("Booking Completed", url_path="/booking/completed")

        props = mock_post.call_args.kwargs["json"]["properties"]
        assert set(props) == {"$current_url", "source"}

    def test_sends_a_timeout_so_slow_analytics_cannot_hang_a_request(self):
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=200)
            track_event("Booking Created", url_path="/booking/created")

        timeout = mock_post.call_args.kwargs["timeout"]
        assert timeout is not None and timeout <= 5.0


class TestTrackEventNeverRaises:
    def test_network_exception_is_swallowed(self):
        with patch("app.services.analytics.httpx.post", side_effect=RuntimeError("boom")):
            track_event("Signup", url_path="/signup")

    def test_non_2xx_response_does_not_raise(self):
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=500)
            track_event("Signup", url_path="/signup")


class TestNoKeyMeansNoNetwork:
    def test_nothing_is_sent_without_a_project_key(self):
        """CI and local dev run with no key; a suite that quietly posted real
        events to production analytics would be worse than no tests."""
        with patch.object(analytics, "POSTHOG_PROJECT_KEY", ""), patch(
            "app.services.analytics.httpx.post"
        ) as mock_post:
            track_event("Signup", url_path="/signup")
        mock_post.assert_not_called()
