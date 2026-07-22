import logging
import re

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Literal, List
from app.categories import allowed_categories_for, resolve_create_category
from app.deps import get_current_user
from app.privacy import mask_service_post_row
from app.services.geocoding import resolve_coordinates
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()

_BUSINESS_CATEGORY_RE = re.compile(r"^[A-Za-z ]+$")


def _escape_ilike(v: str) -> str:
    """Backslash-escape ilike wildcard chars so a literal value can't act as one."""
    return v.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _my_business_id(owner_id: str) -> Optional[str]:
    """The business owned by `owner_id`, or None. Never raises — callers use it
    to decide visibility, and a lookup failure must deny, not 500."""
    try:
        res = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", owner_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0].get("id") if rows else None
    except Exception:
        logger.warning("my_business_id_lookup_failed", exc_info=True)
        return None


# ── Schemas ───────────────────────────────────────────────────────────────────


class ServicePostCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    # Category is required for an OPEN marketplace post but optional (in fact
    # ignored — see create_service_post) for a targeted "Book now" post, whose
    # category is derived from the target business. The model_validator below
    # enforces "category OR target_business_id".
    category: Optional[str] = Field(None, max_length=120)
    budget: float = Field(..., gt=0, le=1_000_000)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    address: Optional[str] = Field(None, max_length=300)
    image_urls: Optional[List[str]] = Field(default_factory=list, max_length=5)
    # LANE C — direct "Book now". When set, this post targets exactly one
    # business: it is visible only in that business's feed and its category is
    # derived from the business (not the client). NULL = open marketplace post.
    # Column added via docs/service_posts_target_business_id.sql.
    target_business_id: Optional[str] = Field(None, max_length=64)
    # GAP-AUDIT-2026-07-18 #63: wizard already collects this, PATCH already
    # accepts it (ServicePostUpdate below) — create was the only gap. Mirrors
    # bookings.py's date-string idiom (plain ISO-8601 string, no strict
    # datetime parsing). Column added via docs/service_posts_preferred_date.sql
    # (FILED, not yet applied).
    preferred_date: Optional[str] = Field(None, max_length=64)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v):
        v = str(v).strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v

    @field_validator("category", "target_business_id", mode="before")
    @classmethod
    def strip_optional(cls, v):
        if v is None:
            return None
        v = str(v).strip()
        return v or None

    @model_validator(mode="after")
    def require_category_or_target(self):
        # A targeted post derives its category from the business, so category is
        # optional there; an open post has no business to derive from, so it
        # must carry one.
        if not self.target_business_id and not self.category:
            raise ValueError("category is required for an open post")
        return self

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

    # LANE C — direct "Book now". A targeted post derives its category from the
    # business the client picked (never asked of the client), and validation
    # that the business exists happens here so a bad id fails loudly instead of
    # writing a dangling FK. The target-business feed branch (list_open_posts)
    # ignores category entirely, so the derived value is belt-and-suspenders —
    # category can never be why a targeted post is invisible to its target.
    target_business_id = data.target_business_id
    if target_business_id:
        biz_res = (
            supabase.table("businesses")
            .select("id, category")
            .eq("id", target_business_id)
            .single()
            .execute()
        )
        if not biz_res.data:
            raise HTTPException(status_code=404, detail="Business not found")
        category = resolve_create_category(biz_res.data.get("category") or "")
    else:
        category = resolve_create_category(data.category)

    try:
        res = (
            supabase.table("service_posts")
            .insert(
                {
                    "client_id": current_user["id"],
                    "title": data.title,
                    "description": data.description,
                    "category": category,
                    "target_business_id": target_business_id,
                    "budget": data.budget,
                    # RO-0: server-side geocoding fallback. When the app sends
                    # coordinates (Places autocomplete) they pass through
                    # untouched; when it sends only an address, resolve here so
                    # the post is mappable instead of silently invisible.
                    **resolve_coordinates(data.lat, data.lng, data.address),
                    "address": data.address,
                    "image_urls": data.image_urls or [],
                    "preferred_date": data.preferred_date,
                    "status": "open",
                }
            )
            .execute()
        )
        return {"message": "Service post created", "post": res.data[0]}
    except HTTPException:
        raise
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
        # Pull the poster's lifecycle flags alongside the public profile so we
        # can drop posts from ghosted / suspended / soft-deleted clients from
        # the business-facing feed. The flags are stripped before returning.
        query = supabase.table("service_posts").select(
            "*, users(first_name, last_name, avatar_url, "
            "is_ghosted, is_suspended, deleted_at)"
        )
        # When no status filter given, default to showing only open posts
        # (preserves existing behaviour); with an explicit status, filter by it
        if status:
            query = query.eq("status", status)
        else:
            query = query.eq("status", "open")

        # LANE C — targeted "Book now" posts (target_business_id set) belong to
        # exactly ONE business's feed. Every branch below except the target-
        # business branch must therefore exclude targeted posts entirely, or a
        # post the client sent to Acme would leak into a broad category browse
        # or another business's feed. `.is_("target_business_id", "null")` does
        # that; the business-owner branch instead widens its own or_ filter to
        # ALSO match posts targeted at itself, regardless of category.
        if category:
            # Explicit param takes precedence over the auto-filter below.
            query = query.ilike("category", _escape_ilike(category.strip()))
            query = query.is_("target_business_id", "null")
        elif current_user["role"] == "business_owner":
            try:
                biz_res = (
                    supabase.table("businesses")
                    .select("id, category")
                    .eq("owner_id", current_user["id"])
                    .limit(1)
                    .execute()
                )
                rows = biz_res.data or []
                biz_id = rows[0].get("id") if rows else None
                biz_category = rows[0].get("category") if rows else None
                if biz_category and _BUSINESS_CATEGORY_RE.match(biz_category):
                    allowed = allowed_categories_for(biz_category)
                    cat_terms = ",".join(f"category.ilike.{c}" for c in allowed)
                    # Untargeted posts matching my category, OR any post targeted
                    # directly at me (category ignored on the targeted branch —
                    # that's the whole point of "Book now").
                    cat_branch = f"and(target_business_id.is.null,or({cat_terms}))"
                    if biz_id:
                        query = query.or_(
                            f"{cat_branch},target_business_id.eq.{biz_id}"
                        )
                    else:
                        query = query.or_(cat_branch)
                else:
                    # Degrade to unfiltered category-wise, but still never leak
                    # a post targeted at some OTHER business.
                    query = query.is_("target_business_id", "null")
            except Exception:
                # Never let a lookup failure 500 the feed — degrade to unfiltered
                # (but still hide targeted-to-others posts).
                logger.warning("business_category_lookup_failed", exc_info=True)
                query = query.is_("target_business_id", "null")
        elif current_user["role"] == "employee":
            # Employees are intentionally unfiltered category-wise for now — no
            # per-employee category assignment exists yet; revisit once it does.
            # Targeted posts still stay out of the open feed.
            query = query.is_("target_business_id", "null")
        else:
            # Any other caller (e.g. a client hitting the open feed) sees only
            # open marketplace posts, never someone else's direct booking.
            query = query.is_("target_business_id", "null")

        res = (
            query.order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        raw_items = res.data or []
        uid = current_user["id"]

        # Two independent protections on the feed, BOTH required:
        #  1) Account lifecycle (PR #29): drop posts whose poster is hidden from
        #     discovery (ghosted / suspended / soft-deleted), then strip those
        #     lifecycle flags off the embedded users object so they never leak.
        #  2) CARD-23 PII masking (main): mask full address + client last name
        #     for everyone except the post's own owner. Feed posts are
        #     pre-acceptance by construction, so there is no "winning business"
        #     exception here — the unmasked view lives on the booking.
        items = []
        for post in raw_items:
            poster = post.get("users") or {}
            hidden = (
                poster.get("is_ghosted")
                or poster.get("is_suspended")
                or poster.get("deleted_at")
            )
            if hidden:
                continue
            if isinstance(poster, dict):
                for flag in ("is_ghosted", "is_suspended", "deleted_at"):
                    poster.pop(flag, None)
            items.append(
                post if post.get("client_id") == uid else mask_service_post_row(post)
            )

        # Paginate on the pre-filter page size so dropping a hidden poster's
        # post never prematurely ends the feed.
        next_offset = offset + limit if len(raw_items) == limit else None
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
        if not res.data:
            raise HTTPException(status_code=404, detail="Post not found")
        # CARD-23: same masking rule as the feed — owner sees their own post
        # unmasked, everyone else gets locality-only address + first name only.
        if res.data.get("client_id") == current_user["id"]:
            return res.data
        # LANE C — a targeted "Book now" post is readable by exactly one
        # business. Without this a business could open any targeted post by id
        # (the feed only hides it), which is how the details of a job a client
        # deliberately sent elsewhere would leak.
        target_business_id = res.data.get("target_business_id")
        if target_business_id and current_user["role"] == "business_owner":
            if _my_business_id(current_user["id"]) != target_business_id:
                raise HTTPException(status_code=404, detail="Post not found")
        return mask_service_post_row(res.data)
    except HTTPException:
        raise
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
        raise HTTPException(status_code=403, detail="Only clients can edit their posts")

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
