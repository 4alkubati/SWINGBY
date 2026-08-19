"""
test_upload_table_drift.py — SB-0013: the allowlist and the sniff table are two
lists that must agree, and nothing was checking that they did.

The M-05 fix introduced content sniffing so a declared content type could no
longer be trusted on its own. It shipped with a `_DECLARED_TO_SNIFFED` table
covering jpeg/jpg/png/gif/webp — while `ALLOWED_CONTENT_TYPES` also listed
`image/heic` and `image/heif`, carrying the comment "iPhone default photo
format — without this every iOS upload 400s".

`matches_declared` returns False when the declared type has no entry in the
table. So a security fix designed to harden the upload path silently broke it
for every iPhone: expo-image-picker passes `asset.mimeType` straight through
(PostJobScreen, ChatScreen, BookingPhotos, ProofOfWork), the request cleared
the allowlist gate and was then refused by the sniffer.

The HEIF brands are now in the table. This file is the part that keeps it
fixed: the failure was never one missing constant, it was that two lists could
disagree without anything noticing. Adding a type to either list without the
other now fails here, for images and for audio.
"""

import pytest

from app.api import uploads
from app.services import audio_sniff, image_sniff


class TestImageTablesAgree:
    @pytest.mark.parametrize("declared", sorted(uploads.ALLOWED_CONTENT_TYPES))
    def test_every_allowed_image_type_can_be_sniffed(self, declared):
        """
        An entry the sniffer does not know is an entry the API accepts and then
        rejects — the worst of both, and invisible until a user reports it.
        """
        assert declared.lower() in image_sniff._DECLARED_TO_SNIFFED, (
            f"{declared} is in ALLOWED_CONTENT_TYPES but has no entry in "
            f"image_sniff._DECLARED_TO_SNIFFED, so every upload declaring it "
            f"is refused after passing the allowlist (SB-0013)"
        )

    def test_heic_is_specifically_covered(self):
        """The regression that started this: iPhone's default photo format."""
        for declared in ("image/heic", "image/heif"):
            assert declared in uploads.ALLOWED_CONTENT_TYPES
            assert declared in image_sniff._DECLARED_TO_SNIFFED

    def test_a_real_heic_header_is_recognised(self):
        """
        A minimal ISO-BMFF box: 4-byte size, "ftyp", then the brand. This is
        what the first bytes of an iPhone photo actually look like.
        """
        payload = (0).to_bytes(4, "big") + b"ftyp" + b"heic" + b"\x00" * 16
        assert image_sniff.matches_declared(
            payload, "image/heic"
        ), "a genuine HEIC header is still refused"

    def test_a_declared_heic_that_is_not_heic_is_still_refused(self):
        """
        The point of sniffing survives the fix — this must not become a hole
        that accepts anything claiming to be HEIC.
        """
        assert not image_sniff.matches_declared(b"GIF89a" + b"\x00" * 16, "image/heic")


class TestAudioTablesAgree:
    @pytest.mark.parametrize("declared", sorted(uploads.ALLOWED_AUDIO_CONTENT_TYPES))
    def test_every_allowed_audio_type_can_be_sniffed(self, declared):
        assert declared.lower() in audio_sniff._DECLARED_TO_FAMILY, (
            f"{declared} is in ALLOWED_AUDIO_CONTENT_TYPES but has no entry in "
            f"audio_sniff._DECLARED_TO_FAMILY — the same shape of bug as "
            f"SB-0013, on the voice-note path"
        )
