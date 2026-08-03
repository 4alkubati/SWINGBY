"""Tests for tools/social_post.py — the thing that actually publishes.

WHY THIS LIVES IN backend/tests
-------------------------------
CI runs exactly one Python command: `pytest backend/tests -q`
(.github/workflows/backend.yml). A test under `tools/` would never run, and an
untested publisher is how a launch post goes out with a 400-character tweet or
a caption claiming something the app does not do. The script is loaded by path
below rather than imported as a package, because `tools/` is not one.

What is worth pinning here is everything that happens BEFORE the network:
whether the right text goes to the right platform, whether a dry run can send,
and whether one platform's failure can take the others down.
"""

import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

_SCRIPT = Path(__file__).resolve().parents[2] / "tools" / "social_post.py"

_spec = importlib.util.spec_from_file_location("social_post", _SCRIPT)
social_post = importlib.util.module_from_spec(_spec)
# Registered BEFORE exec: @dataclass resolves its own module through
# sys.modules[cls.__module__], and a module loaded by path is not there yet —
# every dataclass in the script raises AttributeError without this line.
sys.modules["social_post"] = social_post
_spec.loader.exec_module(social_post)


@pytest.fixture
def posts():
    return social_post.load_posts()


class TestThePostFileIsTheSourceOfTruth:
    def test_both_launch_posts_parse(self, posts):
        assert "launch-2026-08-01" in posts
        assert "launch-2026-08-03" in posts

    def test_x_gets_the_short_form_and_it_fits(self, posts):
        for post in posts.values():
            text = post.text_for("x")
            assert (
                len(text) <= social_post.LIMITS["x"]
            ), f"{post.post_id} is {len(text)} chars — X will reject it"

    def test_instagram_gets_hashtags_and_x_does_not(self, posts):
        post = posts["launch-2026-08-01"]
        assert "#SwingBy" in post.text_for("instagram")
        # Hashtags on X burn characters against a 280 limit for no reach.
        assert "#" not in post.text_for("x")

    def test_no_post_repeats_the_claim_that_had_to_be_pulled(self, posts):
        # A staged 50/50 release does not exist in this codebase (CLAUDE.md,
        # corrected 2026-07-29 after exactly this claim shipped). marketing/
        # still contains the old wording elsewhere; it must not reach a post.
        for post in posts.values():
            body = f"{post.long_form} {post.short_form}".lower()
            for claim in ("two stages", "50%", "half up front", "half now"):
                assert claim not in body, f"{post.post_id} claims {claim!r}"


class TestNothingIsSentWithoutAsking:
    def test_a_dry_run_never_calls_a_sender(self, posts):
        with patch.object(social_post, "send_x") as sender:
            # Even fully configured, a dry run must not touch the network.
            with patch.dict(social_post.os.environ, {"X_BEARER_TOKEN": "t"}):
                results = social_post.publish(
                    posts["launch-2026-08-01"], ["x"], None, live=False
                )
        sender.assert_not_called()
        assert results[0].ok and "DRY RUN" in results[0].detail

    def test_an_unconfigured_platform_is_skipped_not_failed(self, posts):
        # Kira will have Instagram before X. Posting to what exists beats
        # refusing to do anything until everything is set up.
        with patch.dict(social_post.os.environ, {}, clear=True):
            results = social_post.publish(
                posts["launch-2026-08-01"], ["x"], None, live=True
            )
        assert results[0].skipped is True
        assert "X_BEARER_TOKEN" in results[0].detail

    def test_instagram_is_skipped_rather_than_failed_without_an_image(self, posts):
        with patch.dict(
            social_post.os.environ,
            {"IG_USER_ID": "1", "META_ACCESS_TOKEN": "t"},
        ):
            results = social_post.publish(
                posts["launch-2026-08-01"], ["instagram"], None, live=True
            )
        assert results[0].skipped is True
        assert "image" in results[0].detail


class TestOneFailureIsNotAllFailures:
    def test_a_dead_network_does_not_stop_the_others(self, posts):
        env = {
            "X_BEARER_TOKEN": "t",
            "FB_PAGE_ID": "p",
            "META_ACCESS_TOKEN": "t",
        }
        with patch.dict(social_post.os.environ, env), patch.object(
            social_post.SENDERS["x"], "send", side_effect=Exception("boom")
        ), patch.object(
            social_post.SENDERS["facebook"], "send", return_value="fb post 1"
        ):
            results = social_post.publish(
                posts["launch-2026-08-01"], ["x", "facebook"], None, live=True
            )

        by_name = {r.platform: r for r in results}
        assert by_name["x"].ok is False
        assert by_name["facebook"].ok is True

    def test_an_over_length_post_is_refused_before_the_network(self, posts):
        long_post = social_post.Post(
            post_id="too-long",
            title="t",
            long_form="x" * 50,
            short_form="x" * 500,
        )
        with patch.dict(social_post.os.environ, {"X_BEARER_TOKEN": "t"}), patch.object(
            social_post.SENDERS["x"], "send"
        ) as sender:
            results = social_post.publish(long_post, ["x"], None, live=True)

        sender.assert_not_called()
        assert results[0].ok is False
        assert "over the 280 limit" in results[0].detail


class TestExitCode:
    def test_nothing_configured_is_not_an_error(self, capsys):
        with patch.dict(social_post.os.environ, {}, clear=True):
            code = social_post.main(["launch-2026-08-01"])
        assert code == 0
