"""
content_moderation.py — objectionable-content filter for user-generated text.

WHY
---
App Store Guideline 1.2 requires an app with user-generated content to ship "a
method for filtering objectionable material from being posted to the app". That
is a distinct requirement from the report mechanism (1.2b) and the block
mechanism (1.2c): reporting is reactive, this is preventive.

WHAT THIS DOES
--------------
`screen_text` classifies a message/review/post body into one of three outcomes
and returns them as flags, at the same three write choke points that
contact_masking.py already occupies:

    BLOCK  — refuse the write outright (slurs, explicit sexual solicitation,
             credible threats of violence). The caller raises 400.
    FLAG   — store the content, but auto-file a content_report so a human sees
             it. Borderline abuse: profanity aimed at a person, aggressive
             language. Nothing disappears silently.
    CLEAN  — store it, no action.

DESIGN CONSTRAINTS (mirroring contact_masking.py, which is the precedent here)
-----------------------------------------------------------------------------
- Pure function. No DB, no network, no config — so it is trivially testable and
  cannot fail a write by being slow or unreachable.
- Resist trivial evasion: case, diacritics, fullwidth characters, and the
  classic letter/symbol substitutions (@ for a, $ for s, 0 for o, 1/! for i).
- Must NOT mangle legitimate trade talk. This is a home-services marketplace:
  "strip the old caulk", "the pipe is screwed", "kill the power at the breaker",
  "shoot me the quote", "that wall is a bitch to sand" are ordinary messages.
  Word-boundary matching plus a deliberately SHORT hard-block list is what keeps
  false positives away — see tests/test_content_moderation.py for the matrix.

KNOWN TRADE-OFF
---------------
Run-collapsing means a small number of innocent words normalise onto a blocked
term — "Niger" folds onto the same form as the racial slur. Accepted: the term
is word-bounded, the collision set is tiny, and a homeowner booking a cleaner in
Calgary is far likelier to be typing the slur than the country. Revisit if the
platform ever ships outside Canada.

DELIBERATELY NOT A PROFANITY FILTER
-----------------------------------
Swearing is not objectionable content; abuse is. A filter that blocks "shit"
annoys every tradesperson on the platform and catches no abuser, because the
abuser writes the slur instead. So the hard-block list is slurs, sexual
solicitation and threats — categories with no legitimate reading in a
job-booking thread — and general profanity only FLAGS when it is aimed at a
person ("you" / "your"), which is the shape of harassment rather than of a
stubbed toe.
"""

from __future__ import annotations

import re
import unicodedata

# Outcomes
CLEAN = "clean"
FLAG = "flag"
BLOCK = "block"

# Reason codes — these match content_reports.reason in the 2026-07-31 migration
# so an auto-filed report needs no translation layer.
REASON_HATE_SPEECH = "hate_speech"
REASON_SEXUAL_CONTENT = "sexual_content"
REASON_VIOLENCE = "violence"
REASON_HARASSMENT = "harassment"


# ── Normalisation ─────────────────────────────────────────────────────────────
# Fold the text down to a comparison form BEFORE matching, so "H@t3", "ＨＡＴＥ"
# and "hàte" all collapse onto the same string. contact_masking.py folds unicode
# digits for the same reason; this is the alphabetic equivalent.

_LEET = str.maketrans(
    {
        "@": "a",
        "4": "a",
        "8": "b",
        "(": "c",
        "3": "e",
        "6": "g",
        "1": "i",
        "!": "i",
        "|": "i",
        "0": "o",
        "5": "s",
        "$": "s",
        "7": "t",
        "+": "t",
        "2": "z",
    }
)


def _collapse_repeats(text: str) -> str:
    """Squeeze any run of the same character down to one.

    "faaaggot" and "faggot" both become "fagot". Collapsing to ONE rather than
    two matters: an attacker pads the letter that is doubled in the real word
    ("faaaggot"), so a collapse-to-two leaves a string that matches neither the
    padded form nor the original. The SAME function is applied to the term list
    when the matcher is built, which is what keeps the two sides in step — this
    is a comparison form, never anything the user sees.
    """
    return re.sub(r"(.)\1+", r"\1", text)


def _normalise(text: str) -> str:
    """Casefold, strip diacritics, fold fullwidth forms, undo leet substitution.

    NFKD is what turns fullwidth "Ａ" into "A" and separates the accent off "à";
    the combining-mark filter then drops the accent. Doing this before the leet
    translation matters — otherwise a fullwidth digit would survive the fold.
    """
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    folded = stripped.casefold().translate(_LEET)
    # Squeeze whitespace first (so "f a g" does not survive as three words),
    # then collapse character runs. Order matters: collapsing first would turn
    # a double space into a single one and leave the run logic to re-split it.
    squeezed = re.sub(r"\s+", " ", folded).strip()
    return _collapse_repeats(squeezed)


def _word_re(terms: list[str]) -> re.Pattern:
    """Anchor every term on word boundaries.

    This is the single most important false-positive guard: without \\b,
    "analysis" contains a slur fragment, "Scunthorpe" is unsendable, and
    "assessment" trips an obscenity check. Every term here is matched as a whole
    word, and multi-word terms allow flexible internal spacing.
    """
    parts = [
        r"\s+".join(re.escape(_collapse_repeats(w)) for w in t.split()) for t in terms
    ]
    return re.compile(r"\b(?:" + "|".join(parts) + r")\b")


# ── BLOCK: refuse the write ───────────────────────────────────────────────────
# Kept deliberately short. Every entry has no legitimate reading in a message
# between a homeowner and a tradesperson. Slurs are represented by their
# normalised form because that is what the matcher sees.

_HATE_TERMS = [
    # Racial / ethnic / religious slurs.
    "nigger",
    "nigga",
    "kike",
    "spic",
    "wetback",
    "chink",
    "gook",
    "raghead",
    "towelhead",
    "sandnigger",
    "paki",
    # Anti-LGBT slurs.
    "faggot",
    "fag",
    "tranny",
    "dyke",
    # Ableist slur.
    "retard",
    "retarded",
]

_SEXUAL_SOLICITATION_TERMS = [
    "send nudes",
    "send nude",
    "send pics of your",
    "sex for",
    "pay for sex",
    "suck my dick",
    "suck my cock",
    "eat my pussy",
    "want to fuck you",
    "wanna fuck you",
    "fuck you hard",
    "show me your tits",
    "show me your pussy",
    "show me your dick",
    "sit on my face",
]

_VIOLENCE_TERMS = [
    "i will kill you",
    "im going to kill you",
    "i am going to kill you",
    "i will find you and",
    "ill kill you",
    "i will hurt you",
    "i will beat you",
    "ill beat you",
    "im going to hurt you",
    "i know where you live",
    "i will burn your house",
    "you are dead",
    "youre dead",
    "i will stab you",
    "i will shoot you",
]

_HATE_RE = _word_re(_HATE_TERMS)
_SEXUAL_RE = _word_re(_SEXUAL_SOLICITATION_TERMS)
_VIOLENCE_RE = _word_re(_VIOLENCE_TERMS)


# ── FLAG: store, but file a report ────────────────────────────────────────────
# Profanity ONLY counts when aimed at a person. "this drywall is fucked" is a
# tradesperson describing drywall; "you are fucked" is directed at someone. The
# distinction is the second-person pronoun, so it is required by the pattern
# rather than checked separately.
#
# The 20-character proximity window is a deliberate over-catch: "if you think
# that's stupid" will flag. That costs an admin one dismissal; the opposite
# error costs a 1.2 rejection. FLAG never blocks a send, so the sender never
# sees it — the noise is paid for entirely on the admin side.

# NOTE: these alternatives are written in COLLAPSED form (dumbas, ashole,
# worthles, shit -> shit) because screen_text matches against the normalised
# string, where every character run is already squeezed to one. Writing
# "dumbass" here would silently never match. The _word_re() helper does this
# collapse automatically; this pattern is hand-built for the proximity logic, so
# it has to do it by hand.
_DIRECTED_ABUSE_RE = re.compile(
    r"\b(?:you|your|u|ur)\b[^.!?]{0,20}?\b(?:"
    r"idiot|moron|stupid|dumbas|scumbag|scum|ashole|"
    r"bitch|bastard|piece of shit|worthles|pathetic|loser"
    r")\b"
    r"|"
    r"\b(?:"
    r"idiot|moron|dumbas|scumbag|ashole|bitch|bastard|loser"
    r")\b[^.!?]{0,15}?\b(?:you|your|u|ur)\b"
)

# Explicit sexual language that is not solicitation — store it, flag it, let a
# human decide. Separated from the BLOCK list because context can redeem it.
_SEXUAL_FLAG_RE = _word_re(
    ["nudes", "porn", "blowjob", "handjob", "escort service", "hooker"]
)


def screen_text(text: str) -> tuple[str, list[str]]:
    """
    Return (outcome, reasons).

    outcome is CLEAN / FLAG / BLOCK. `reasons` holds content_reports.reason
    codes, so a FLAG can be turned straight into an auto-filed report and a
    BLOCK can tell the user which rule they hit without leaking the term list.

    Never raises. Empty/whitespace text is CLEAN — emptiness is a validation
    concern, not a moderation one.
    """
    if not text or not text.strip():
        return CLEAN, []

    norm = _normalise(text)
    if not norm:
        return CLEAN, []

    reasons: list[str] = []

    if _HATE_RE.search(norm):
        reasons.append(REASON_HATE_SPEECH)
    if _SEXUAL_RE.search(norm):
        reasons.append(REASON_SEXUAL_CONTENT)
    if _VIOLENCE_RE.search(norm):
        reasons.append(REASON_VIOLENCE)

    if reasons:
        return BLOCK, reasons

    if _DIRECTED_ABUSE_RE.search(norm):
        reasons.append(REASON_HARASSMENT)
    if _SEXUAL_FLAG_RE.search(norm):
        reasons.append(REASON_SEXUAL_CONTENT)

    if reasons:
        return FLAG, reasons

    return CLEAN, []


# User-facing copy for a refused write. Deliberately does NOT echo the matched
# term (that turns the filter into an oracle for probing the list) and does not
# name a category the sender can argue about — it states the rule.
BLOCK_MESSAGE = (
    "This message can't be sent. SwingBy doesn't allow hate speech, sexual "
    "solicitation, or threats. Repeated attempts can get your account suspended."
)
