"""Tests for app/text_safety.py — keeping unstorable characters out of Postgres.

Production, 2026-08-13, Sentry SWINGBY-API-17 on POST /service-posts/:

    APIError: unsupported Unicode escape sequence

Postgres `text` cannot hold a NUL. JSON can carry one, Pydantic's length and
type checks pass it, and the failure names neither the field nor the row — the
request 500s and the post is lost.

The far more dangerous failure mode is the FIX, not the bug: a scrubber that
also eats emoji, accents or Arabic would silently mangle user text in an app
that ships EN/FR/AR. That is invisible, unlike a 500, so most of this file is
about what must SURVIVE.
"""

import pytest

from app.text_safety import scrub, scrub_required


class TestStripsWhatPostgresCannotStore:
    def test_nul_is_removed(self):
        assert scrub("clean\x00house") == "cleanhouse"

    def test_the_actual_production_payload_shape(self):
        """A JSON "\\u0000" decodes to a real NUL before it ever reaches us."""
        import json

        decoded = json.loads('"Deep clean \\u0000 2 bed"')
        assert "\x00" in decoded
        assert "\x00" not in scrub(decoded)

    def test_other_c0_controls_removed(self):
        assert scrub("a\x01b\x07c\x1fd\x7fe") == "abcde"

    def test_tab_newline_carriage_return_survive(self):
        """Real formatting in a 2000-char description. Stripping these would
        silently reflow what the user wrote."""
        assert scrub("line1\nline2\ttabbed\r\n") == "line1\nline2\ttabbed\r\n"


class TestKeepsEverythingLegitimate:
    """The app ships EN/FR/AR. Mangling these would be a worse bug than the 500."""

    @pytest.mark.parametrize(
        "text",
        [
            "Deep clean 🧹✨",
            "Café déjà vu — naïve",
            "تنظيف عميق للمنزل",
            "‏مرحبا‎",  # RTL/LTR marks
            "深度清洁",
            "Ünïcødé ÅÄÖ",
            "emoji with ZWJ: 👨‍👩‍👧‍👦",
            "price: 100 € / 100 $",
        ],
    )
    def test_survives_unchanged(self, text):
        assert scrub(text) == text


class TestPassThrough:
    def test_none_passes(self):
        assert scrub(None) is None

    def test_non_string_passes(self):
        assert scrub(123) == 123


class TestScrubRequired:
    def test_returns_cleaned_value(self):
        assert scrub_required("ok\x00") == "ok"

    def test_raises_when_only_control_chars(self):
        """min_length=3 would pass "\\x00\\x00\\x00" and then store nothing.
        The length check runs on the raw value, so this has to raise here."""
        with pytest.raises(ValueError):
            scrub_required("\x00\x00\x00")

    def test_raises_when_whitespace_only_after_scrub(self):
        with pytest.raises(ValueError):
            scrub_required("\x00  \x00")

    def test_emoji_only_title_is_allowed(self):
        """Not our call to reject. Storable is the only question here."""
        assert scrub_required("🧹") == "🧹"


class TestEveryProseModelScrubs:
    """The first version of this fix covered service posts only.

    A NUL reaching Postgres is not a service-post problem, it is a "user typed
    text" problem — chat, reviews, disputes, admin resolutions, timeline notes
    and photo captions all take free text into a `text` column and all could
    500 identically. This pins every one of them, so the next prose endpoint
    that forgets ScrubbedText fails here rather than in production.
    """

    def test_message_content(self):
        from app.api.messages import MessageSend

        b = "22222222-2222-2222-2222-222222222222"
        assert MessageSend(booking_id=b, content="hi\x00 there 🧹").content == (
            "hi there 🧹"
        )

    def test_review_comment(self):
        from app.api.reviews import ReviewCreate

        assert ReviewCreate(
            booking_id="x", rating=5, comment="great\x00job"
        ).comment == ("greatjob")

    def test_dispute_description_and_resolution(self):
        from app.api.disputes import DisputeCreate, DisputeResolve

        d = DisputeCreate(
            booking_id="x",
            issue_type="quality",
            description="the work was\x00 unfinished",
        )
        assert "\x00" not in d.description
        assert "\x00" not in DisputeResolve(resolution="refund\x00 issued").resolution

    def test_timeline_note(self):
        from app.api.booking_events import CreateEvent

        assert CreateEvent(event_type="en_route", note="on my\x00 way").note == (
            "on my way"
        )

    def test_photo_caption(self):
        from app.api.booking_photos import AttachPhoto

        p = AttachPhoto(
            path="p/x.jpg", url="https://x/y.jpg", phase="after", caption="done\x00 ✅"
        )
        assert p.caption == "done ✅"

    def test_scrub_runs_before_length_validation(self):
        """Ordering matters: a description that only reaches min_length BECAUSE
        of its control characters must be rejected, not stored short."""
        import pytest as _pytest
        from pydantic import ValidationError

        from app.api.disputes import DisputeCreate

        with _pytest.raises(ValidationError):
            DisputeCreate(
                booking_id="x", issue_type="quality", description="bad\x00\x00\x00work"
            )

    def test_arabic_and_emoji_survive_the_real_models(self):
        from app.api.reviews import ReviewCreate

        text = "ممتاز جدا 🎉 café"
        assert ReviewCreate(booking_id="x", rating=5, comment=text).comment == text
