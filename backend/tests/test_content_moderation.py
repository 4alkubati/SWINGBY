"""
test_content_moderation.py — the Guideline 1.2(a) objectionable-content filter.

Structured like test_contact_masking.py, and for the same reason: a filter on a
home-services marketplace is only as good as its FALSE-POSITIVE matrix. A filter
that blocks a plumber saying "the pipe is screwed" is worse than no filter,
because it breaks the product for every honest user and stops no abuser — the
abuser simply writes something the list does not contain.

So the tests below are weighted the way the risk is: a handful of true-positive
cases, and a large matrix of ordinary trade talk that must sail through.
"""

import pytest

from app.services.content_moderation import (
    BLOCK,
    CLEAN,
    FLAG,
    REASON_HARASSMENT,
    REASON_HATE_SPEECH,
    REASON_SEXUAL_CONTENT,
    REASON_VIOLENCE,
    screen_text,
)


def _outcome(text):
    return screen_text(text)[0]


class TestClean:
    """Ordinary marketplace messages. Every one of these must be CLEAN."""

    @pytest.mark.parametrize(
        "text",
        [
            # Plain scheduling / quoting.
            "Hi, can you come by Tuesday around 10:30?",
            "The quote is $180 for the full job, parts included.",
            "I'm at 123 Main St NW, Calgary AB T2N 1N4 — buzzer 4.",
            "Sounds good, see you then!",
            "",
            "   ",
            # Trade vocabulary that reads badly to a naive filter.
            "Strip the old caulk before you re-seal the tub.",
            "That pipe is completely screwed, we'll have to cut it out.",
            "Kill the power at the breaker before you touch the panel.",
            "Shoot me the quote when you get a chance.",
            "The drywall in that corner is fucked, honestly.",
            "This grout is a bitch to clean.",
            "I'll blow out the sprinkler lines before the freeze.",
            "We need to bang out the dent in the eavestrough.",
            "The unit died on us halfway through.",
            "Screw the bracket into the stud, not the drywall.",
            # Words that CONTAIN a blocked substring but are not the term.
            # This is the Scunthorpe class — the single most common way a
            # profanity filter embarrasses itself.
            "I'll do a full analysis of the wiring.",
            "The assessment is free.",
            "Class starts at six.",
            "He's from Pakistan originally.",
            "Let me check the spec sheet.",
            "Bass fishing season starts soon.",
            "The cassette on that bike is worn.",
            # Prices, quantities, dates — shared with the contact-masking matrix.
            "3 bedrooms, 2 baths, roughly 1,400 sq ft.",
            "Booking is for 2026-08-01 at 09:00.",
        ],
    )
    def test_ordinary_message_is_clean(self, text):
        assert _outcome(text) == CLEAN, f"false positive on: {text!r}"


class TestBlocked:
    """Content with no legitimate reading in a job thread. Refused on write."""

    def test_racial_slur_is_blocked(self):
        outcome, reasons = screen_text("get out of here you nigger")
        assert outcome == BLOCK
        assert REASON_HATE_SPEECH in reasons

    def test_homophobic_slur_is_blocked(self):
        outcome, reasons = screen_text("what a faggot")
        assert outcome == BLOCK
        assert REASON_HATE_SPEECH in reasons

    def test_sexual_solicitation_is_blocked(self):
        outcome, reasons = screen_text("forget the invoice, just send nudes")
        assert outcome == BLOCK
        assert REASON_SEXUAL_CONTENT in reasons

    def test_threat_of_violence_is_blocked(self):
        outcome, reasons = screen_text("pay me or i will kill you")
        assert outcome == BLOCK
        assert REASON_VIOLENCE in reasons

    def test_address_threat_is_blocked(self):
        outcome, reasons = screen_text("i know where you live")
        assert outcome == BLOCK
        assert REASON_VIOLENCE in reasons


class TestEvasion:
    """Normalisation has to survive the obvious dodges."""

    @pytest.mark.parametrize(
        "text",
        [
            "you f@ggot",  # leet substitution
            "you FAGGOT",  # case
            "you faaaggot",  # character repetition
            "you fággot",  # diacritics
            "you ｆａｇｇｏｔ",  # fullwidth
        ],
    )
    def test_obfuscated_slur_still_blocks(self, text):
        assert _outcome(text) == BLOCK, f"evaded on: {text!r}"

    def test_spaced_threat_still_blocks(self):
        assert _outcome("i   will    kill   you") == BLOCK


class TestFlagged:
    """Borderline. Stored and delivered, but a report is raised for a human."""

    def test_directed_insult_is_flagged_not_blocked(self):
        outcome, reasons = screen_text("you are a complete idiot")
        assert outcome == FLAG
        assert REASON_HARASSMENT in reasons

    def test_undirected_profanity_is_clean(self):
        # The same word, not aimed at a person. This is the distinction the
        # whole FLAG tier exists to draw.
        assert _outcome("this job is a complete disaster") == CLEAN

    def test_flag_reasons_are_valid_report_reasons(self):
        """A FLAG is turned straight into a content_reports row, so its reason
        codes must already be values that table's CHECK accepts."""
        from app.api.moderation import VALID_REASONS

        _, reasons = screen_text("you are a complete idiot")
        assert reasons
        assert set(reasons) <= VALID_REASONS


class TestContract:
    def test_never_raises_on_odd_input(self):
        for text in ["", "   ", "\n\n", "🙂🙂🙂", "\x00", "a" * 5000]:
            screen_text(text)

    def test_returns_reason_codes_only_when_not_clean(self):
        outcome, reasons = screen_text("see you tuesday")
        assert outcome == CLEAN
        assert reasons == []
