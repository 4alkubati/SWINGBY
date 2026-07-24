"""
contact_masking.py — off-platform-leakage guard for chat messages (item 31).

WHY
---
SwingBy takes a commission on every booking. Chat opens on the interest
(quote) thread the moment a business quotes an OPEN job post — before the
client accepts and before any money moves (see backend/app/api/messages.py
send_message: an interest thread is sendable while the post is `open`). That
is a wide-open channel for a client and a business to swap phone numbers or
emails and finish the job off-platform, which is direct revenue leakage.

WHAT THIS DOES
--------------
Detects contact details — phone numbers and email addresses — in message text
and replaces each with a visible marker, so the number/email never lands in a
readable form. Masking is applied on WRITE (a single choke point in
send_message), so the raw contact string is never stored and cannot be pulled
back out through any read path.

DESIGN CONSTRAINTS (from the brief)
-----------------------------------
- Must resist trivial evasion: spaced digits ("4 0 3 …"), unicode/fullwidth
  digits ("４０３…"), and dash/dot separators.
- Must NOT mangle legitimate messages: prices ($180.00, $1,234.56), street
  addresses ("123 Main St NW, Calgary AB T2N 1N4"), dates/times ("2026-08-01",
  "10:30"), quantities ("3 bedrooms"). See tests/test_contact_masking.py for
  the full false-positive matrix.

The rule of thumb that keeps false positives away: a North-American phone
number normalises to exactly 10 digits (or 11 with a leading country-code 1).
Prices, addresses, dates and quantities essentially never present as a single
run of 10 digits — and where a decimal point or comma appears (prices), we
deliberately let it break the run so a price can never be read as a phone.
"""

from __future__ import annotations

import re
import unicodedata

MASK_TOKEN = "[contact hidden — keep it on SwingBy]"

# ── Unicode digit normalisation ────────────────────────────────────────────────
# Fullwidth digits (４), Arabic-Indic (٤), Devanagari, etc. all carry a decimal
# value; fold every such code point down to its ASCII digit so "４０３…" can't
# sneak past an ASCII-only regex.
_DIGIT_FOLD = {}
for _cp in range(0x110000):
    _ch = chr(_cp)
    if _ch.isdigit() and _ch not in "0123456789":
        try:
            _DIGIT_FOLD[_cp] = ord(str(unicodedata.digit(_ch)))
        except (ValueError, TypeError):
            pass


def _fold_digits(text: str) -> str:
    return text.translate(_DIGIT_FOLD)


# ── Detectors ──────────────────────────────────────────────────────────────────

# 1. Email — standard, plus a common spoken evasion ("john at gmail dot com").
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_EMAIL_SPOKEN_RE = re.compile(
    r"[A-Za-z0-9._%+\-]+\s+at\s+[A-Za-z0-9.\-]+\s+dot\s+[A-Za-z]{2,}",
    re.IGNORECASE,
)

# 2. Well-formed phone: NANP 3-3-4, separators optional, optional +1 / 1 prefix.
#    Handles "(403) 555-1234", "403-555-1234", "403.555.1234", "403 555 1234",
#    "4035551234", "+1 403 555 1234". The (?<!\d)/(?!\d) guards stop a 10-digit
#    slice of a longer number (order ids etc.) from matching.
_PHONE_STRICT_RE = re.compile(
    r"(?<!\d)"
    r"(?:\+?1[\s.\-]?)?"
    r"\(?\d{3}\)?[\s.\-]?"
    r"\d{3}[\s.\-]?"
    r"\d{4}"
    r"(?!\d)"
)

# 3. 7-digit local, but ONLY with a dash/dot between the 3 and 4 groups
#    ("555-1234", "555.1234"). A *space* is deliberately excluded — "555 1234"
#    is far more likely two quantities than a local number.
_PHONE_LOCAL_RE = re.compile(r"(?<!\d)\d{3}[.\-]\d{4}(?!\d)")

# 4. Obfuscated run: a maximal run of digits joined only by spaces, hyphens or
#    parens that normalises to exactly 10 digits (or 11 with a leading 1).
#    Catches "4 0 3 5 5 5 1 2 3 4". Comma and period are NOT run characters, so
#    a price ("1,234.56") or a decimal can never be swept into a run — that is
#    what protects prices from being read as phone numbers.
_RUN_RE = re.compile(r"[0-9][0-9 ()\-]*[0-9]")


def _mask_runs(text: str) -> str:
    def repl(m: re.Match) -> str:
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) == 10 or (len(digits) == 11 and digits[0] == "1"):
            return MASK_TOKEN
        return m.group(0)

    return _RUN_RE.sub(repl, text)


def mask_contact_info(text: str) -> tuple[str, bool]:
    """
    Return (masked_text, was_masked).

    Idempotent: re-masking already-masked text is a no-op. `was_masked` lets the
    caller surface a "we hid that — keep it on SwingBy" notice to the user.
    """
    if not text:
        return text, False

    folded = _fold_digits(text)

    out = _EMAIL_SPOKEN_RE.sub(MASK_TOKEN, folded)
    out = _EMAIL_RE.sub(MASK_TOKEN, out)
    out = _PHONE_STRICT_RE.sub(MASK_TOKEN, out)
    out = _PHONE_LOCAL_RE.sub(MASK_TOKEN, out)
    out = _mask_runs(out)

    return out, (out != folded)
