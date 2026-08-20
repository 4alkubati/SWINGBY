"""
audio_sniff.py — trust the bytes, not the header (checklist #12).

THE FINDING
-----------
D7.9 fixed `POST /uploads/image` to verify magic bytes and left `POST
/uploads/audio` fifty lines below doing exactly what the image endpoint had
just been fixed for: allow-listing on `file.content_type`, the value the CLIENT
types into the multipart form, and then storing the object in Supabase under
that same declared type.

So `audio/mpeg` was a claim anybody could make about any bytes at all, and the
object came back out of storage labelled as the attacker described it.

WHY THE AUDIO BUCKET IS LESS EXPOSED THAN THE IMAGE ONE, AND WHY IT STILL
MATTERS
-------------------------------------------------------------------------
`voice-notes` is private and read exclusively through short-lived signed URLs
(`uploads.sign_audio_path`), where `job-photos` is public-read. That is a real
mitigation and it is why this was never the more urgent half. It is not a
defence: a signed URL is still a URL, it is handed to a real person's browser
or webview, and "the payload is only reachable for an hour" is not a property
worth relying on when the fix is a byte comparison.

WHAT THIS IS NOT
----------------
Same scope as image_sniff: not a virus scanner, not a container validator. It
answers "do these bytes begin the way this format begins", which is precisely
the question the endpoint was not asking.

FORMAT NOTES
------------
* **MPEG-4 family** (.m4a/.mp4/.aac-in-MP4) — ISO base media format: bytes 4-8
  are `ftyp`, and the four bytes after that are the brand (`M4A `, `mp42`,
  `isom`, …). The first four bytes are a box length, so the signature does NOT
  start at offset 0 — checking `startswith` here would never match.
* **ADTS AAC** (raw .aac) — frame sync `0xFFF` in the top 12 bits.
* **MP3** — either an `ID3` tag or a raw frame sync (`0xFF` then `0xE0` set).
* **WAV** — `RIFF` <4-byte size> `WAVE`, the same container shape WebP uses,
  which is exactly why image_sniff checks WebP's trailing marker rather than
  `RIFF` alone.
"""

from typing import Optional

# ISO-BMFF brands we accept. `mif1`/`heic` are image brands and are deliberately
# absent — an HEIC renamed to .m4a must not pass as audio just because both
# formats share the ftyp container.
_MP4_AUDIO_BRANDS = {
    b"M4A ",
    b"M4B ",
    b"mp42",
    b"mp41",
    b"isom",
    b"iso2",
    b"dash",
    b"M4V ",
    b"qt  ",
}


def _is_mp4_container(contents: bytes) -> bool:
    if len(contents) < 12 or contents[4:8] != b"ftyp":
        return False
    return contents[8:12] in _MP4_AUDIO_BRANDS


def _is_adts_aac(contents: bytes) -> bool:
    # 12-bit sync word: 1111 1111 1111
    return (
        len(contents) >= 2
        and contents[0] == 0xFF
        and (contents[1] & 0xF6) in (0xF0, 0xF2, 0xF4, 0xF6)
    )


def _is_mp3(contents: bytes) -> bool:
    if contents.startswith(b"ID3"):
        return True
    # Raw MPEG audio frame sync: 11 bits set.
    return len(contents) >= 2 and contents[0] == 0xFF and (contents[1] & 0xE0) == 0xE0


def _is_wav(contents: bytes) -> bool:
    return len(contents) >= 12 and contents[:4] == b"RIFF" and contents[8:12] == b"WAVE"


def sniff(contents: bytes) -> Optional[str]:
    """Return a coarse family name for these bytes, or None.

    One of "mp4", "aac", "mp3", "wav" — a FAMILY, not a mime type, because the
    mapping from mime to family is many-to-one (audio/mp4, audio/m4a and
    audio/x-m4a are all the same container) and pretending otherwise would mean
    rejecting a legitimate iOS recording over which of three synonyms the OS
    happened to pick.

    Order matters: the MP4 check runs before the ADTS/MP3 sync checks because
    an MP4 box length can begin with 0xFF and would otherwise be misread as a
    raw frame sync.
    """
    if not contents:
        return None
    if _is_mp4_container(contents):
        return "mp4"
    if _is_wav(contents):
        return "wav"
    if _is_adts_aac(contents):
        return "aac"
    if _is_mp3(contents):
        return "mp3"
    return None


# Declared content type -> the families whose bytes satisfy it. Explicit rather
# than derived, for the same reason image_sniff spells its table out: adding a
# content type to the endpoint's allow-list without deciding what its bytes look
# like should be impossible.
_DECLARED_TO_FAMILY = {
    "audio/mp4": {"mp4"},
    "audio/m4a": {"mp4"},
    "audio/x-m4a": {"mp4"},
    # ADTS AAC and AAC-in-MP4 are both sold as audio/aac by different recorders.
    "audio/aac": {"aac", "mp4"},
    "audio/mpeg": {"mp3"},
    "audio/wav": {"wav"},
    "audio/x-wav": {"wav"},
}


def matches_declared(contents: bytes, declared: Optional[str]) -> bool:
    """True if the bytes back up the content type the client claimed."""
    family = sniff(contents)
    if family is None:
        return False
    allowed = _DECLARED_TO_FAMILY.get((declared or "").lower())
    if allowed is None:
        return False
    return family in allowed
