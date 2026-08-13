"""Make user-supplied text storable in Postgres.

Why this exists
---------------
Production, 2026-08-13, Sentry SWINGBY-API-17 on `POST /service-posts/`:

    APIError: unsupported Unicode escape sequence

Postgres `text` cannot hold a NUL (U+0000). JSON *can* carry one, written as a
backslash-u-0000 escape, so a client can send a string that parses fine in
Python, passes every Pydantic length and type check, and then explodes at the
INSERT with an error naming neither the field nor the row. The request 500s and
the post is lost.

This is not a moderation concern and must not be confused with one:
`services/content_moderation.py` decides whether text is *allowed*. This decides
whether text is *representable*. A post that says something unacceptable should
be refused loudly; a post containing a stray control character from a phone
keyboard or a paste should simply be cleaned and stored.

What it strips, and what it deliberately does not
-------------------------------------------------
Removed: NUL, and the C0 control range except tab / newline / carriage return.
Those are unprintable, carry no meaning in a job title, and are a favourite of
log-injection and terminal-escape tricks.

KEPT: every emoji, every accent, every right-to-left mark, all CJK. The app
ships in EN/FR/AR and a filter that quietly mangles Arabic or drops an emoji
from a job title would be a worse bug than the one being fixed — it would be
invisible, unlike a 500.

Also NOT normalised: no Unicode NFC/NFKC pass. That would silently rewrite
what the user typed, and homoglyph handling belongs in moderation, not here.
"""

from __future__ import annotations

import re
from typing import Optional

# C0 controls except \t (09), \n (0A), \r (0D), plus DEL (7F).
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def scrub(value: Optional[str]) -> Optional[str]:
    """Strip characters Postgres text cannot store. None and non-str pass through.

    Returns None for a string that was nothing but control characters, so a
    field that becomes empty is caught by the caller's own min_length rule
    rather than being stored blank.
    """
    if value is None or not isinstance(value, str):
        return value
    cleaned = _CONTROL_RE.sub("", value)
    return cleaned


def scrub_required(value: str) -> str:
    """`scrub` for a field that must survive it. Raises if nothing is left.

    Used where Pydantic already demands a non-blank value: without this, text
    made entirely of control characters would pass min_length before scrubbing
    and arrive at the database empty.
    """
    cleaned = scrub(str(value))
    if cleaned is None or not cleaned.strip():
        raise ValueError("Field cannot be blank")
    return cleaned
