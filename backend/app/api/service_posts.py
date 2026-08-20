import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Literal, List
from app.categories import allowed_categories_for, resolve_create_category
from app.deps import get_current_user
from app.privacy import mask_service_post_row
from app.services import expiry_sweep
from app.services.geocoding import resolve_coordinates
from app.text_safety import scrub, scrub_required
from app.services.push import send_push_to_user
from app.services.visibility import blocked_pair_ids
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
        # scrub_required before strip: a title of nothing but control characters
        # passes min_length=3 and then dies at the INSERT. See app/text_safety.py.
        v = scrub_required(v).strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v

    @field_validator("description", "address", mode="before")
    @classmethod
    def scrub_free_text(cls, v):
        # Sentry SWINGBY-API-17, 2026-08-13: "unsupported Unicode escape
        # sequence" — a NUL reached Postgres, which cannot store one in `text`.
        # JSON can carry it, Pydantic's length checks pass it, and the failure
        # names neither the field nor the row.
        return scrub(v)

    @field_validator("category", "target_business_id", mode="before")
    @classmethod
    def strip_optional(cls, v):
        if v is None:
            return None
        v = str(scrub(v)).strip()
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
            v = scrub_required(v).strip()
            if not v:
                raise ValueError("Field cannot be blank")
        return v

    @field_validator("description", "address", mode="before")
    @classmethod
    def scrub_free_text(cls, v):
        # PATCH is the other way in — the create path being clean is no use if
        # an edit can still put a NUL in the same column.
        return scrub(v)

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
    target_owner_id = None
    if target_business_id:
        biz_res = (
            supabase.table("businesses")
            .select("id, category, owner_id")
            .eq("id", target_business_id)
            .single()
            .execute()
        )
        if not biz_res.data:
            raise HTTPException(status_code=404, detail="Business not found")
        category = resolve_create_category(biz_res.data.get("category") or "")
        target_owner_id = biz_res.data.get("owner_id")
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
        post = res.data[0]

        # M12 / direct-request notification. A targeted "Book now" post is one
        # client asking ONE company for a quote — a different event from an
        # open-post broadcast, and the only signal that company gets that
        # somebody is waiting on them. Labelled "Requesting a quote" so the
        # business can tell it apart from an ordinary lead.
        #
        # The body carries the job title and nothing about the client: this push
        # fires pre-acceptance, so it obeys the same rule as the feed (see
        # app/privacy.py) — no name, no address, no photos. Best-effort; a push
        # failure must never fail the post.
        if target_owner_id:
            try:
                send_push_to_user(
                    target_owner_id,
                    "Requesting a quote",
                    f"A client asked your company directly: {data.title}",
                )
            except Exception:
                logger.warning(
                    "direct_request_push_failed for post %s",
                    post.get("id"),
                    exc_info=True,
                )

        # TRIGGER 1 (charge-before-service, ruling 2026-07-21): the intent is to
        # collect money at post time. This CANNOT capture in the current schema
        # — at post there is no matched business, no agreed price, and no
        # bookings row for payments.booking_id (NOT NULL) to point at, and the
        # client has no saved card. trigger_on_post is gated OFF and reports
        # honestly rather than pretending to charge. Turning it on requires
        # card-on-file (Stripe SetupIntent), which does not exist in this repo.
        # Wired here so the trigger point is real; capture lands when
        # card-on-file does. Never raises.
        try:
            from app.services import payment_triggers

            charge = payment_triggers.trigger_on_post(post=post, client=current_user)
        except Exception:
            logger.exception("trigger_on_post failed for post %s", post.get("id"))
            charge = {"triggered": False, "reason": "trigger_error"}

        return {
            "message": "Service post created",
            "post": post,
            "payment_started": bool(charge.get("triggered")),
        }
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

    # Settle this client's expired posts before listing them.
    #
    # `expiry_sweep` existed for weeks with no caller (no APPLICATION scheduler in
    # this deployment — see services/approvals.py), so an expired post kept
    # saying "open" forever and any escrow against it was never returned. This
    # is the same self-healing-on-read shape the 24h escrow release uses, and
    # this is the right read to hang it on: the person opening My Jobs is the
    # person owed the refund, and only their own posts are examined.
    #
    # Best-effort by construction — sweep_for_client never raises.
    expiry_sweep.sweep_for_client(current_user["id"])

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
        # AUDIT L1 (2026-07-24): the embed used to be
        #   users(first_name, last_name, avatar_url, is_ghosted, …)
        # and the name/avatar were fetched only to be stripped again. Don't
        # fetch what may never be returned — one bad `return res.data` and the
        # whole feed leaks. The ONLY reason a users join survives here is the
        # lifecycle filter below (posts by ghosted / suspended / soft-deleted
        # clients must not appear), so the projection is exactly those three
        # flags and nothing else. The `users` key itself is removed from every
        # row before it leaves this function.
        query = supabase.table("service_posts").select(
            "*, users(is_ghosted, is_suspended, deleted_at)"
        )
        # When no status filter given, default to showing only open posts
        # (preserves existing behaviour); with an explicit status, filter by it
        if status:
            query = query.eq("status", status)
        else:
            query = query.eq("status", "open")
            # …and genuinely open, not merely still labelled that way.
            #
            # A post stays status='open' until something sweeps it, and until
            # today nothing did (see services/expiry_sweep.py). Businesses were
            # therefore shown week-old dead posts and could quote them. This
            # feed does not sweep — a business must not pay the cost of another
            # user's refunds on a browse — it just refuses to show a post whose
            # expiry has passed. The client's own read settles the money.
            query = query.gt("expires_at", datetime.now(timezone.utc).isoformat())

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
                # A business category is user-entered, and its value is
                # interpolated into a PostgREST `or=(...)` expression below, so
                # it cannot be trusted raw — a comma or a paren would break out
                # of the filter. The OLD guard was a regex on the raw category
                # that, on a miss, threw the category filter away entirely and
                # showed that business EVERY open post in the city. Any category
                # containing an ampersand, a hyphen or a digit ("Lawn & Garden",
                # "24-7 Plumbing"), or an empty one, silently landed there.
                #
                # Filtering the ALLOWLIST instead of gating on the input is
                # strictly better: allowed_categories_for() snaps to the
                # canonical labels and always appends "General", which is
                # itself safe — so the sanitized list is never empty and an
                # unrecognised category degrades to a TIGHT feed (General +
                # anything targeted at me) instead of an unfiltered one. The
                # spam shield holds for every category shape.
                allowed = [
                    c
                    for c in allowed_categories_for(biz_category or "")
                    if _BUSINESS_CATEGORY_RE.match(c)
                ]
                if allowed:
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
                    # Unreachable in practice (GENERAL is always allowed and
                    # always safe) — kept so a future edit to categories.py
                    # cannot turn this into an unfiltered feed by accident.
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
        #     discovery (ghosted / suspended / soft-deleted). The flags are the
        #     only thing the users join is for, and the join is dropped from the
        #     row immediately afterwards.
        #  2) PII masking (audit L1/L2/L3 + ruling S1, 2026-07-24): a business
        #     sees NOTHING identifying about a client pre-acceptance — no name,
        #     no avatar, no client_id, no budget, no photos, locality only. Feed
        #     posts are pre-acceptance by construction, so there is no "winning
        #     business" exception here — the unmasked view lives on the booking.
        #  3) Moderation (Guideline 1.2): a post hidden by an admin leaves the
        #     feed, and so does a post by anyone on either side of a block with
        #     the viewer. The block set is read once for the whole page.
        blocked = blocked_pair_ids(supabase, uid)

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
            if post.get("hidden_at"):
                continue
            if post.get("client_id") in blocked:
                continue
            if post.get("client_id") == uid:
                # The client's own post — nothing to hide from themselves. The
                # lifecycle join is internal plumbing, so it goes either way.
                post.pop("users", None)
                items.append(post)
            else:
                items.append(mask_service_post_row(post))

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
        # No users(...) join at all: the owner does not need their own profile
        # echoed back, and nobody else may see it (audit L1). Same reasoning as
        # list_open_posts — never fetch PII a response must not contain.
        res = (
            supabase.table("service_posts")
            .select("*")
            .eq("id", post_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Post not found")
        # Same masking rule as the feed — the owner sees their own post
        # unmasked, everyone else gets the anonymous pre-acceptance view.
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
