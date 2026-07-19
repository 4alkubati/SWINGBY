import logging
import re

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, List
from app.categories import allowed_categories_for, resolve_create_category
from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()

_BUSINESS_CATEGORY_RE = re.compile(r"^[A-Za-z ]+$")


def _escape_ilike(v: str) -> str:
    """Backslash-escape ilike wildcard chars so a literal value can't act as one."""
    return v.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# ── Schemas ───────────────────────────────────────────────────────────────────


class ServicePostCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    category: str = Field(..., min_length=1, max_length=120)
    budget: float = Field(..., gt=0, le=1_000_000)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    address: Optional[str] = Field(None, max_length=300)
    image_urls: Optional[List[str]] = Field(default_factory=list, max_length=5)
    # GAP-AUDIT-2026-07-18 #63: wizard already collects this, PATCH already
    # accepts it (ServicePostUpdate below) — create was the only gap. Mirrors
    # bookings.py's date-string idiom (plain ISO-8601 string, no strict
    # datetime parsing). Column added via docs/service_posts_preferred_date.sql
    # (FILED, not yet applied).
    preferred_date: Optional[str] = Field(None, max_length=64)

    @field_validator("title", "category", mode="before")
    @classmethod
    def strip_str(cls, v):
        v = str(v).strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v

    @field_validator("image_urls", mode="before")
    @classmethod
    def validate_image_urls(cls, v):
        if v is None:
            return []
        if not isinstance(v, list):
            raise ValueError("image_urls must be a list")
        if len(v) > 5:
            raise ValueError("Maximum 5 images per post")
        return [str(url).strip() for url in v if url]


class ServicePostUpdate(BaseModel):
    """
    PATCH /service-posts/{post_id} body. Editable fields only — see
    GAP-AUDIT-2026-07-18 #3. category is deliberately NOT editable here.

    preferred_date mirrors bookings.py's date-string idiom (plain ISO-8601
    string, no strict datetime parsing) — column added via
    docs/service_posts_preferred_date.sql (FILED, not yet applied; see
    GAP-AUDIT-2026-07-18 #63, which this PATCH surfaces on the edit side).
    """

    title: Optional[str] = Field(None, min_length=3, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    budget: Optional[float] = Field(None, gt=0, le=1_000_000)
    address: Optional[str] = Field(None, max_length=300)
    image_urls: Optional[List[str]] = Field(None, max_length=5)
    preferred_date: Optional[str] = Field(None, max_length=64)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v):
        if v is not None:
            v = str(v).strip()
            if not v:
                raise ValueError("Field cannot be blank")
        return v

    @field_validator("image_urls", mode="before")
    @classmethod
    def validate_image_urls(cls, v):
        if v is None:
            return None
        if not isinstance(v, list):
            raise ValueError("image_urls must be a list")
        if len(v) > 5:
            raise ValueError("Maximum 5 images per post")
        return [str(url).strip() for url in v if url]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/")
def create_service_post(
    data: ServicePostCreate, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "client":
        raise HTTPException(
            status_code=403, detail="Only clients can create service posts"
        )

    try:
        res = (
            supabase.table("service_posts")
            .insert(
                {
                    "client_id": current_user["id"],
                    "title": data.title,
                    "description": data.description,
                    "category": resolve_create_category(data.category),
                    "budget": data.budget,
                    "lat": data.lat,
                    "lng": data.lng,
                    "address": data.address,
                    "image_urls": data.image_urls or [],
                    "preferred_date": data.preferred_date,
                    "status": "open",
                }
            )
            .execute()
        )
        return {"message": "Service post created", "post": res.data[0]}
    except Exception:
        logger.exception("Could not create service post")
        raise HTTPException(status_code=400, detail="Could not create service post")


@router.get("/my")
def list_my_posts(
    status: Optional[Literal["open", "matched", "expired", "cancelled"]] = Query(None),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "client":
        raise HTTPException(
            status_code=403, detail="Only clients can view their own posts"
        )
    try:
        query = (
            supabase.table("service_posts")
            .select("*, interests(count)")
            .eq("client_id", current_user["id"])
        )
        if status:
            query = query.eq("status", status)
        res = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        items = res.data or []
        # Flatten the interests aggregate into interest_count (quote badge in My Jobs)
        for item in items:
            agg = item.pop("interests", None)
            item["interest_count"] = (
                agg[0].get("count", 0) if isinstance(agg, list) and agg else 0
            )
        next_offset = offset + limit if len(items) == limit else None
        return {
            "items": items,
            "limit": limit,
            "offset": offset,
            "next_offset": next_offset,
        }
    except Exception:
        logger.exception("Could not list service posts")
        raise HTTPException(status_code=400, detail="Could not list service posts")


@router.get("/")
def list_open_posts(
    category: Optional[str] = Query(None, max_length=120),
    status: Optional[Literal["open", "matched", "expired", "cancelled"]] = Query(None),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user),
):
    try:
        query = supabase.table("service_posts").select(
            "*, users(first_name, last_name, avatar_url)"
        )
        # When no status filter given, default to showing only open posts
        # (preserves existing behaviour); with an explicit status, filter by it
        if status:
            query = query.eq("status", status)
        else:
            query = query.eq("status", "open")

        if category:
            # Explicit param takes precedence over the auto-filter below.
            query = query.ilike("category", _escape_ilike(category.strip()))
        elif current_user["role"] == "business_owner":
            try:
                biz_res = (
                    supabase.table("businesses")
                    .select("category")
                    .eq("owner_id", current_user["id"])
                    .limit(1)
                    .execute()
                )
                rows = biz_res.data or []
                biz_category = rows[0].get("category") if rows else None
                if biz_category and _BUSINESS_CATEGORY_RE.match(biz_category):
                    allowed = allowed_categories_for(biz_category)
                    query = query.or_(",".join(f"category.ilike.{c}" for c in allowed))
                # else: degrade to unfiltered (unknown/unsafe category value)
            except Exception:
                # Never let a lookup failure 500 the feed — degrade to unfiltered.
                logger.warning("business_category_lookup_failed", exc_info=True)
        elif current_user["role"] == "employee":
            # Employees are intentionally unfiltered for now — no per-employee
            # category assignment exists yet; revisit once it does.
            pass

        res = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        items = res.data or []
        next_offset = offset + limit if len(items) == limit else None
        return {
            "items": items,
            "limit": limit,
            "offset": offset,
            "next_offset": next_offset,
        }
    except Exception:
        logger.exception("Could not list open service posts")
        raise HTTPException(status_code=400, detail="Could not list service posts")


@router.get("/{post_id}")
def get_service_post(post_id: str, current_user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("service_posts")
            .select("*, users(first_name, last_name, avatar_url)")
            .eq("id", post_id)
            .single()
            .execute()
        )
        return res.data
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")


@router.patch("/{post_id}")
def update_service_post(
    post_id: str,
    data: ServicePostUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Client-only edit of a posted job — GAP-AUDIT-2026-07-18 #3. Owner-only
    and open-status-only (same guard shape as DELETE /{post_id} below):
    once an interest has been accepted and the post has left 'open', edits
    are rejected.
    """
    if current_user["role"] != "client":
        raise HTTPException(
            status_code=403, detail="Only clients can edit their posts"
        )

    post = (
        supabase.table("service_posts")
        .select("client_id, status")
        .eq("id", post_id)
        .single()
        .execute()
    )
    if not post.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.data["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You don't own this post")
    if post.data["status"] != "open":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit a post with status '{post.data['status']}'",
        )

    update_fields = data.model_dump(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        res = (
            supabase.table("service_posts")
            .update(update_fields)
            .eq("id", post_id)
            .execute()
        )
        return {"message": "Post updated", "post": res.data[0]}
    except Exception:
        logger.exception("Could not update service post")
        raise HTTPException(status_code=400, detail="Could not update service post")


@router.delete("/{post_id}")
def cancel_service_post(post_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "client":
        raise HTTPException(
            status_code=403, detail="Only clients can cancel their posts"
        )

    post = (
        supabase.table("service_posts")
        .select("client_id, status")
        .eq("id", post_id)
        .single()
        .execute()
    )
    if not post.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.data["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You don't own this post")
    if post.data["status"] != "open":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a post with status '{post.data['status']}'",
        )

    try:
        supabase.table("service_posts").update({"status": "cancelled"}).eq(
            "id", post_id
        ).execute()
        return {"message": "Post cancelled"}
    except Exception:
        logger.exception("Could not cancel service post")
        raise HTTPException(status_code=400, detail="Could not cancel service post")
