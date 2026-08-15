"""
image_sniff.py — D7.9 (pentest M-05): trust the bytes, not the header.

THE FINDING
-----------
`POST /uploads/image` checked `file.content_type` — the content type the CLIENT
declared in the multipart form — and nothing else. So an SVG declared as
`image/jpeg` was accepted and stored, and an EICAR test string was accepted too.
There was no magic-byte check anywhere in the path.

Mitigations that did hold, and are worth keeping in mind before deciding how
alarmed to be: Supabase serves the object back with the declared content type
rather than sniffing it, a real PHP payload was WAF-blocked at the edge, and
the 10 MB cap is enforced. The gap is real; it was not a live RCE.

WHY SVG SPECIFICALLY MATTERS
----------------------------
SVG is not a picture, it is a document — it can carry `<script>`, and a browser
asked to render one will execute it. An SVG stored in a public bucket and
served under a permissive content type is stored XSS with a `.jpg` on the end.
So SVG is not in the allowlist below, and cannot be, no matter what the form
says it is.

WHAT THIS IS NOT
----------------
Not a virus scanner. It answers one question — "do these bytes begin the way a
JPEG/PNG/WebP/GIF begins" — which is exactly the question the endpoint was
failing to ask. Content scanning is a different control and a different budget.
"""

from typing import Optional

# Magic-byte signatures, longest first where prefixes could overlap.
#
# WebP and (rarely) other RIFF-family files share the first four bytes, so WebP
# is matched on the container form `RIFF....WEBP` rather than on `RIFF` alone —
# otherwise a WAV would pass as an image.
_SIGNATURES = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
)

# Content types the endpoint accepts, mapped to the sniffed types that satisfy
# them. Kept explicit rather than derived so that adding a declared type without
# thinking about its bytes is not possible.
_DECLARED_TO_SNIFFED = {
    "image/jpeg": {"image/jpeg"},
    "image/jpg": {"image/jpeg"},
    "image/png": {"image/png"},
    "image/gif": {"image/gif"},
    "image/webp": {"image/webp"},
}


def sniff(contents: bytes) -> Optional[str]:
    """Return the image type these bytes actually are, or None.

    None means "not a raster image we recognise" — which includes SVG, HTML,
    scripts, archives and an EICAR string. The caller refuses on None.
    """
    if not contents:
        return None

    for signature, mime in _SIGNATURES:
        if contents.startswith(signature):
            return mime

    # WebP: 'RIFF' <4-byte little-endian size> 'WEBP'
    if len(contents) >= 12 and contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return "image/webp"

    return None


def matches_declared(contents: bytes, declared: Optional[str]) -> bool:
    """True if the bytes back up the content type the client claimed.

    Both halves have to hold. Sniffing alone would let a client declare
    `image/png` and upload a JPEG — harmless in itself, but it is the declared
    type Supabase serves the object back with, so a mismatch means the stored
    object is labelled as something it is not. Agreement is the property worth
    having.
    """
    sniffed = sniff(contents)
    if sniffed is None:
        return False
    allowed = _DECLARED_TO_SNIFFED.get((declared or "").lower())
    if allowed is None:
        return False
    return sniffed in allowed
