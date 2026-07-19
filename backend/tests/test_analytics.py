"""
test_analytics.py — CARD-23 GOAL 4 (audit K7 — no-analytics).

app.services.analytics.track_event() POSTs a minimal funnel event to
Plausible's keyless Events API. Verified live 2026-07-19: a real POST in
this exact payload shape returned HTTP 202 for "Signup", "Booking Created",
and "Booking Completed" (see CARD-23-report.md / BACKEND-report.md for the
transcript). These tests pin the contract with a mock so CI doesn't depend
on network access, plus the one hard rule that matters most here: analytics
failures must never surface to the caller or block the request path.
"""

from unittest.mock import MagicMock, patch

from app.services.analytics import track_event, PLAUSIBLE_DOMAIN, PLAUSIBLE_EVENT_URL


class TestTrackEventPayloadShape:
    def test_sends_correct_domain_name_and_synthesized_url(self):
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=202)
            track_event("Signup", url_path="/signup", props={"role": "client"})

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == PLAUSIBLE_EVENT_URL
        assert kwargs["json"]["domain"] == PLAUSIBLE_DOMAIN
        assert kwargs["json"]["name"] == "Signup"
        assert kwargs["json"]["url"] == f"app://{PLAUSIBLE_DOMAIN}/signup"
        assert kwargs["json"]["props"] == {"role": "client"}
        assert "User-Agent" in kwargs["headers"]

    def test_omits_props_key_when_none_given(self):
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=202)
            track_event("Booking Completed", url_path="/booking/completed")

        _, kwargs = mock_post.call_args
        assert "props" not in kwargs["json"]

    def test_sends_a_timeout_so_a_slow_plausible_cannot_hang_a_request(self):
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=202)
            track_event("Booking Created", url_path="/booking/created")

        _, kwargs = mock_post.call_args
        assert kwargs["timeout"] is not None
        assert kwargs["timeout"] <= 5.0


class TestTrackEventNeverRaises:
    def test_network_exception_is_swallowed(self):
        with patch(
            "app.services.analytics.httpx.post", side_effect=RuntimeError("boom")
        ):
            # Must not raise — this is the whole point of the module.
            track_event("Signup", url_path="/signup")

    def test_non_2xx_response_does_not_raise(self):
        with patch("app.services.analytics.httpx.post") as mock_post:
            mock_post.return_value = MagicMock(status_code=500)
            track_event("Signup", url_path="/signup")
        # httpx.post() itself doesn't raise on non-2xx (no raise_for_status
        # call in track_event) — reaching this line at all is the assertion.
