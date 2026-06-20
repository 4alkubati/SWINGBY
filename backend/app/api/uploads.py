import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB
BUCKET = "job-photos"


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
        if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
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
