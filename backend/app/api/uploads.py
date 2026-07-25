import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    # iPhone default photo format — without this every iOS upload 400s.
    "image/heic",
    "image/heif",
}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB
BUCKET = "job-photos"

# ---------------------------------------------------------------------------
# Voice memos (walkthrough M6) — a SEPARATE, PRIVATE bucket
# ---------------------------------------------------------------------------
#
# `job-photos` is public-read and image-only, and neither of those is right
# here. A proof-of-work memo is a business standing inside a client's home
# narrating what they found ("this pipe is cracked, the wall behind it is
# soaked"). That is the audio equivalent of L3 in the walkthrough audit — the
# item that called client photos "a burglary recon tool" — so the bucket is
# private and every read goes out as a short-lived signed URL. Nothing here is
# guessable-URL-protected.
AUDIO_BUCKET = "voice-notes"
ALLOWED_AUDIO_CONTENT_TYPES = {
    # Android MediaRecorder (expo-audio HIGH_QUALITY) writes .m4a in an MPEG-4
    # container, and reports it under any of these three depending on OS level.
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    # iOS AVAudioRecorder .m4a, plus the two fallbacks a dev build can produce.
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
}
ALLOWED_AUDIO_EXTS = {"m4a", "mp4", "aac", "mp3", "wav"}
# 60 s hard cap (enforced in the app, in the API, and by a CHECK on the table)
# at HIGH_QUALITY AAC is well under 2 MB. 8 MB is a generous ceiling that still
# refuses anything that is obviously not a one-minute memo.
MAX_AUDIO_BYTES = 8 * 1024 * 1024
AUDIO_URL_TTL_SECONDS = 60 * 60  # 1 h — long enough to review, short enough to expire


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a job photo to Supabase Storage and return its public URL."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, WebP, and GIF images are allowed",
        )

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 10 MB")

    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext not in {"jpg", "jpeg", "png", "webp", "gif", "heic", "heif"}:
            ext = "jpg"

    path = f"posts/{current_user['id']}/{uuid.uuid4()}.{ext}"

    try:
        supabase.storage.from_(BUCKET).upload(
            path=path,
            file=contents,
            file_options={"content-type": file.content_type, "upsert": False},
        )
        url = supabase.storage.from_(BUCKET).get_public_url(path)
        return {"url": url, "path": path}
    except Exception:
        logger.exception("Image upload failed for user %s", current_user["id"])
        raise HTTPException(status_code=500, detail="Could not upload image")


@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a proof-of-work voice memo and return a signed URL + storage path.

    The caller stores the `path`; the `url` is a signed URL that expires. Readers
    (`proof_of_work._voice_note`) re-sign the path on every read rather than
    trusting the one saved at write time — see `sign_audio_path` below.
    """
    if file.content_type not in ALLOWED_AUDIO_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only m4a, aac, mp3 and wav audio is allowed",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The recording was empty")
    if len(contents) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="Recording must be under 8 MB")

    ext = "m4a"
    if file.filename and "." in file.filename:
        candidate = file.filename.rsplit(".", 1)[-1].lower()
        if candidate in ALLOWED_AUDIO_EXTS:
            ext = candidate

    path = f"voice-notes/{current_user['id']}/{uuid.uuid4()}.{ext}"

    try:
        supabase.storage.from_(AUDIO_BUCKET).upload(
            path=path,
            file=contents,
            file_options={"content-type": file.content_type, "upsert": "false"},
        )
    except Exception:
        logger.exception("Voice-note upload failed for user %s", current_user["id"])
        raise HTTPException(status_code=500, detail="Could not upload the recording")

    return {"url": sign_audio_path(path) or "", "path": path}


def sign_audio_path(path: str) -> str | None:
    """Mint a short-lived signed URL for a private voice-note object.

    Returns None if the object is gone or storage is unreachable — callers treat
    that as "no playable memo" rather than surfacing a dead URL to the client.
    """
    if not path:
        return None
    try:
        res = supabase.storage.from_(AUDIO_BUCKET).create_signed_url(
            path, AUDIO_URL_TTL_SECONDS
        )
    except Exception:
        logger.exception("Could not sign voice note at %s", path)
        return None

    if isinstance(res, dict):
        # supabase-py has used both keys across versions; accept either.
        return res.get("signedURL") or res.get("signedUrl")
    return None


@router.delete("/audio")
async def delete_audio(
    path: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a previously uploaded voice memo (must be owned by the caller)."""
    expected_prefix = f"voice-notes/{current_user['id']}/"
    if not path.startswith(expected_prefix):
        raise HTTPException(status_code=403, detail="You cannot delete this file")

    try:
        supabase.storage.from_(AUDIO_BUCKET).remove([path])
        return {"message": "Recording deleted"}
    except Exception:
        logger.exception("Voice-note deletion failed for path %s", path)
        raise HTTPException(status_code=500, detail="Could not delete the recording")


@router.delete("/image")
async def delete_image(
    path: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a previously uploaded job photo (must be owned by the caller)."""
    expected_prefix = f"posts/{current_user['id']}/"
    if not path.startswith(expected_prefix):
        raise HTTPException(status_code=403, detail="You cannot delete this file")

    try:
        supabase.storage.from_(BUCKET).remove([path])
        return {"message": "Image deleted"}
    except Exception:
        logger.exception("Image deletion failed for path %s", path)
        raise HTTPException(status_code=500, detail="Could not delete image")
