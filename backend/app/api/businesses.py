import math
from collections import defaultdict
from datetime import datetime, timezone, timedelta

import structlog
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from app.categories import normalize_category
from app.deps import get_current_user
from app.supabase_client import supabase
from app.limiter import limiter
from app.services import search_index
from app.services.visibility import hidden_user_ids

logger = structlog.get_logger(__name__)

router = APIRouter()

# Ceiling on rows scanned by the in-process search fallback (tier 3, used only
# when the work-index RPC is unavailable). Bounded so a missing migration can
# never turn a search into a full-table scan.
_FALLBACK_SCAN_LIMIT = 500


# ── Helpers ─────────────────────────────────────────────────────────────────


def _escape_ilike(v: str) -> str:
    """Backslash-escape ilike wildcard chars so a literal value can't act as one."""
    return v.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


# ── Schemas ───────────────────────────────────────────────────────────────────


class BusinessCreate(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=120)
    category: str = Field(..., min_length=1, max_length=120)
    custom_category: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    license_number: Optional[str] = Field(None, max_length=500)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    service_radius_km: Optional[float] = Field(25.0, ge=1.0, le=500.0)

    @field_validator("business_name", "category", mode="before")
    @classmethod
    def strip_str(cls, v):
        return str(v).strip() if v else v


class BusinessUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=1, max_length=120)
    category: Optional[str] = Field(None, min_length=1, max_length=120)
    custom_category: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = Field(None, max_length=2000)
    license_number: Optional[str] = Field(None, max_length=500)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    service_radius_km: Optional[float] = Field(None, ge=1.0, le=500.0)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/")
def create_business(
    data: BusinessCreate, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can create a business"
        )

    existing = (
        supabase.table("businesses")
        .select("id")
        .eq("owner_id", current_user["id"])
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=400, detail="You already have a business registered"
        )

    try:
        payload = {"owner_id": current_user["id"], **data.model_dump(exclude_none=True)}
        if payload.get("category"):
            payload["category"] = normalize_category(payload["category"])
        # RO-0 note: no server-side geocoding fallback here, deliberately.
        # `businesses` stores no address — only lat/lng (BusinessCreate above),
        # so there is nothing to geocode from. A business gets coordinates only
        # from the mobile Places autocomplete in BusinessSetupScreen.js, which
        # was dead until EXPO_PUBLIC_GOOGLE_PLACES_KEY was set. New businesses
        # resolve correctly now; pre-existing coordinate-less rows cannot be
        # backfilled without first adding an address column. Tracked in the
        # RO-0 PR description as the one gap this card does not close.
        res = supabase.table("businesses").insert(payload).execute()
        return {"message": "Business created", "business": res.data[0]}
    except Exception:
        logger.exception("create_business_error")
        raise HTTPException(status_code=400, detail="Could not create business")


@router.get("/nearby")
def get_nearby_businesses(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Caller latitude"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Caller longitude"),
    radius_km: float = Query(25.0, ge=1.0, le=200.0, description="Search radius in km"),
    category: Optional[str] = Query(None, max_length=120),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user),
):
    """
    Geo-browse: return businesses whose service area covers the caller's location.

    Uses a bounding-box pre-filter in the query, then Haversine exact filtering
    in Python (no PostGIS required). Supports pagination via limit/offset.
    Returns an empty items list on any database error so the mobile home screen
    shows "No businesses nearby" rather than crashing with a 500.
    """
    try:
        # Rough degree offsets for the bounding box (1° lat ≈ 111 km)
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * math.cos(math.radians(lat)) + 1e-9)

        query = (
            supabase.table("businesses")
            .select("*")
            .gte("lat", lat - lat_delta)
            .lte("lat", lat + lat_delta)
            .gte("lng", lng - lng_delta)
            .lte("lng", lng + lng_delta)
        )
        if category:
            # Case-insensitive match: mobile sends the lowercase CategoryScroll
            # chip id (e.g. "cleaning") but the DB stores the capitalized
            # canonical label (e.g. "Cleaning") — same idiom as list_businesses
            # (this file) and service_posts.py::list_open_posts. A raw .eq()
            # here silently returns zero results (DQ-BK1).
            query = query.ilike("category", _escape_ilike(category.strip()))

        res = query.execute()
        businesses = res.data or []

        # Hide businesses whose owner is ghosted / suspended / soft-deleted.
        hidden_owners = hidden_user_ids(
            supabase, [b.get("owner_id") for b in businesses]
        )

        # Exact Haversine filter — only include businesses whose service radius
        # overlaps the caller's location
        nearby = []
        for biz in businesses:
            if biz.get("owner_id") in hidden_owners:
                continue
            biz_lat = biz.get("lat")
            biz_lng = biz.get("lng")
            if biz_lat is None or biz_lng is None:
                continue
            try:
                dist = _haversine_km(lat, lng, float(biz_lat), float(biz_lng))
            except (TypeError, ValueError):
                logger.warning(
                    "nearby_bad_coords", biz_id=biz.get("id"), lat=biz_lat, lng=biz_lng
                )
                continue
            biz_radius = float(biz.get("service_radius_km") or 25.0)
            if dist <= min(radius_km, biz_radius):
                nearby.append({**biz, "distance_km": round(dist, 2)})

        # Sort closest first
        nearby.sort(key=lambda b: b["distance_km"])

        # Apply pagination on the sorted result
        page = nearby[offset : offset + limit]
        next_offset = offset + limit if len(page) == limit else None

        return {
            "items": page,
            "limit": limit,
            "offset": offset,
            "next_offset": next_offset,
        }

    except Exception:
        logger.exception(
            "nearby_businesses_error", lat=lat, lng=lng, radius_km=radius_km
        )
        return {"items": [], "limit": limit, "offset": offset, "next_offset": None}


@router.get("/me")
def get_my_business(current_user: dict = Depends(get_current_user)):
    # Employees resolve to their employer's business (read-only flag for mobile).
    # Without this, employee logins land in BusinessNavigator and every screen
    # 403s on its first fetch.
    if current_user["role"] == "employee":
        try:
            emp = (
                supabase.table("employees")
                .select("business_id")
                .eq("user_id", current_user["id"])
                .eq("is_active", True)
                .single()
                .execute()
            )
            res = (
                supabase.table("businesses")
                .select("*")
                .eq("id", emp.data["business_id"])
                .single()
                .execute()
            )
            return {**res.data, "is_employee": True}
        except Exception:
            raise HTTPException(
                status_code=404, detail="No business linked to this employee"
            )

    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners have a business profile"
        )
    try:
        res = (
            supabase.table("businesses")
            .select("*")
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
        return res.data
    except Exception:
        raise HTTPException(
            status_code=404, detail="No business found for this account"
        )


@router.get("/me/analytics")
@limiter.limit("30/minute")
def get_my_analytics(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Business owner analytics: earnings, bookings, categories, reviews."""
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can view analytics"
        )

    uid = current_user["id"]

    try:
        # 1. Fetch this owner's business
        biz_res = (
            supabase.table("businesses")
            .select("id, avg_rating, review_count")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if not biz_res.data:
            raise HTTPException(
                status_code=404, detail="No business found for this account"
            )
        biz = biz_res.data
        biz_id = biz["id"]

        # 2. All bookings for this business
        bookings_res = (
            supabase.table("bookings")
            .select("id, total_amount, created_at, post_id")
            .eq("business_id", biz_id)
            .execute()
        )
        bookings = bookings_res.data or []
        total_bookings = len(bookings)

        # 3. Total earnings (sum of released_to_business from released payments)
        booking_ids = [b["id"] for b in bookings]
        total_earnings = 0.0
        if booking_ids:
            payments_res = (
                supabase.table("payments")
                .select("released_to_business, status")
                .in_("booking_id", booking_ids)
                .execute()
            )
            for p in payments_res.data or []:
                # fix C: "settled" is in no enum, so total_earnings was always
                # 0.00. Released on-platform earnings live on rows whose
                # payments.status == 'fully_released'.
                if p.get("status") == "fully_released" and p.get(
                    "released_to_business"
                ):
                    total_earnings += float(p["released_to_business"])

        # 4. Bookings by month (last 6 months)
        six_months_ago = datetime.now(timezone.utc) - timedelta(days=182)
        monthly: dict = defaultdict(lambda: {"count": 0, "revenue": 0.0})
        for b in bookings:
            try:
                dt = datetime.fromisoformat(b["created_at"].replace("Z", "+00:00"))
            except (TypeError, ValueError):
                continue
            if dt < six_months_ago:
                continue
            month_key = dt.strftime("%Y-%m")
            monthly[month_key]["count"] += 1
            monthly[month_key]["revenue"] += float(b.get("total_amount") or 0)
        bookings_by_month = [
            {"month": k, "count": v["count"], "revenue": round(v["revenue"], 2)}
            for k, v in sorted(monthly.items())
        ]

        # 5. Top categories from service_posts linked to this business's bookings
        post_ids = [b["post_id"] for b in bookings if b.get("post_id")]
        top_categories = []
        if post_ids:
            posts_res = (
                supabase.table("service_posts")
                .select("category")
                .in_("id", post_ids)
                .execute()
            )
            cat_counts: dict = defaultdict(int)
            for p in posts_res.data or []:
                if p.get("category"):
                    cat_counts[p["category"]] += 1
            top_categories = [
                {"category": cat, "count": cnt}
                for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1])
            ][:5]

        # 6. Conversion rate from interests
        interests_res = (
            supabase.table("interests")
            .select("status")
            .eq("business_id", biz_id)
            .execute()
        )
        interests = interests_res.data or []
        total_interests = len(interests)
        accepted_interests = sum(1 for i in interests if i.get("status") == "accepted")
        conversion_rate = (
            round(accepted_interests / total_interests * 100, 1)
            if total_interests
            else 0.0
        )

        # 7. Recent reviews (last 5, join reviewer first name)
        # Business reviews are stored with reviewee_id = business id (not the
        # owner's user id) and reviewee_type = "business" — see reviews.py:58.
        # Querying reviewee_id = uid (the owner) matched nothing (GAP #62).
        reviews_res = (
            supabase.table("reviews")
            .select("id, rating, comment, created_at, reviewer_id")
            .eq("reviewee_id", biz_id)
            .eq("reviewee_type", "business")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        recent_reviews = []
        for rev in reviews_res.data or []:
            client_first_name = ""
            try:
                user_res = (
                    supabase.table("users")
                    .select("first_name")
                    .eq("id", rev["reviewer_id"])
                    .single()
                    .execute()
                )
                client_first_name = (user_res.data or {}).get("first_name", "")
            except Exception:
                pass
            recent_reviews.append(
                {
                    "id": rev["id"],
                    "rating": rev["rating"],
                    "comment": rev.get("comment", ""),
                    "client_first_name": client_first_name,
                    "created_at": rev["created_at"],
                }
            )

        return {
            "avg_rating": float(biz.get("avg_rating") or 0),
            "review_count": int(biz.get("review_count") or 0),
            "total_bookings": total_bookings,
            "total_earnings": round(total_earnings, 2),
            "profile_views": 0,
            "conversion_rate": conversion_rate,
            "repeat_rate": 0,
            "bookings_by_month": bookings_by_month,
            "top_categories": top_categories,
            "recent_reviews": recent_reviews,
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("get_my_analytics_error", uid=uid)
        raise HTTPException(status_code=500, detail="Analytics unavailable")


def _attach_distance(
    items: list[dict],
    lat: Optional[float],
    lng: Optional[float],
    radius_km: Optional[float],
) -> list[dict]:
    """
    Annotate each business with `distance_km` when the caller's coords are known,
    and drop anything outside `radius_km` when one was supplied.

    Businesses with no coordinates survive an unfiltered call (they simply get
    no distance) but are dropped once a radius is requested — an unlocatable
    business cannot be shown to satisfy a distance constraint.
    """
    if lat is None or lng is None:
        return items

    out: list[dict] = []
    for biz in items:
        biz_lat, biz_lng = biz.get("lat"), biz.get("lng")
        if biz_lat is None or biz_lng is None:
            if radius_km is None:
                out.append(biz)
            continue
        try:
            dist = _haversine_km(lat, lng, float(biz_lat), float(biz_lng))
        except (TypeError, ValueError):
            logger.warning("search_bad_coords", biz_id=biz.get("id"))
            continue
        if radius_km is not None:
            biz_radius = float(biz.get("service_radius_km") or 25.0)
            if dist > min(radius_km, biz_radius):
                continue
        out.append({**biz, "distance_km": round(dist, 2)})
    return out


def _search_by_work(
    q: str,
    category: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
    radius_km: Optional[float],
    limit: int,
    offset: int,
) -> dict:
    """
    Rank businesses by how much their COMPLETED WORK resembles `q`.

    Three tiers, one response shape (LANE F — see app/services/search_index.py
    and docs/business_work_index.sql):
      1. semantic  — pgvector cosine over the work corpus (flag-gated, dormant)
      2. work_lexical — weighted tsvector + pg_trgm over the work corpus (LIVE)
      3. name_fallback — in-process ranking over name/category/description, used
         only when the work-index RPC is unavailable (e.g. migration not applied
         on a dev DB). Still corpus-aware, so it beats the old name-only ilike.

    Ranking happens in the DB but hydration/filtering/pagination happen here, so
    the ghost-owner filter and the radius filter still apply to the ranked set.
    """
    mode = "semantic" if search_index.semantic_search_available() else "work_lexical"

    ranked = search_index.rank_business_ids(supabase, q, category)
    if ranked is None:
        # Tier 3: no work index to query. Scan a bounded page of businesses and
        # rank them in-process rather than 500ing or falling back to name-only.
        mode = "name_fallback"
        scan = supabase.table("businesses").select("*")
        if category and category.strip():
            scan = scan.ilike("category", _escape_ilike(category.strip()))
        scan_res = scan.limit(_FALLBACK_SCAN_LIMIT).execute()
        candidates = scan_res.data or []
        ranked = search_index.rank_businesses_in_process(q, candidates)
        by_id = {b.get("id"): b for b in candidates}
    else:
        ids = [r["business_id"] for r in ranked]
        by_id = {}
        if ids:
            hydrated = supabase.table("businesses").select("*").in_("id", ids).execute()
            by_id = {b.get("id"): b for b in (hydrated.data or [])}

    # Rebuild in rank order, carrying the score/reason onto each row.
    items = []
    for row in ranked:
        biz = by_id.get(row["business_id"])
        if not biz:
            continue
        items.append(
            {
                **biz,
                "match_score": round(row["match_score"], 4),
                "match_reason": row.get("match_reason"),
            }
        )

    # Hide businesses whose owner is ghosted / suspended / soft-deleted.
    hidden_owners = hidden_user_ids(supabase, [b.get("owner_id") for b in items])
    if hidden_owners:
        items = [b for b in items if b.get("owner_id") not in hidden_owners]

    items = _attach_distance(items, lat, lng, radius_km)

    # Paginate AFTER filtering so a page is never silently short.
    page = items[offset : offset + limit]
    next_offset = offset + limit if len(items) > offset + limit else None
    return {
        "items": page,
        "limit": limit,
        "offset": offset,
        "next_offset": next_offset,
        "query": q,
        "search_mode": mode,
    }


@router.get("/")
def list_businesses(
    q: Optional[str] = Query(
        None,
        max_length=120,
        description=(
            "Work-history search: ranks businesses by how much the work they "
            "have COMPLETED resembles the query (e.g. 'big house'). No location "
            "required."
        ),
    ),
    category: Optional[str] = Query(None, max_length=120),
    lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Caller lat"),
    lng: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Caller lng"),
    radius_km: Optional[float] = Query(
        None,
        ge=1.0,
        le=200.0,
        description="Filter to businesses within this radius (needs lat+lng, and q)",
    ),
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user),
):
    """
    List businesses. With `q`, results are ranked by WORK HISTORY — the titles,
    descriptions and categories of the jobs each business actually completed —
    not by name. Without `q`, this is a plain (optionally category-filtered)
    listing. Neither path requires location, so browse still works when
    geolocation is denied; `lat`/`lng` only add `distance_km`, and `radius_km`
    filters alongside `q` (use /nearby for pure geo-browse).
    """
    try:
        if q and q.strip():
            return _search_by_work(
                q.strip(), category, lat, lng, radius_km, limit, offset
            )

        query = supabase.table("businesses").select("*")
        if category:
            # Case-insensitive match: mobile sends the lowercase CategoryScroll
            # chip id (e.g. "cleaning") but the DB stores the capitalized
            # canonical label (e.g. "Cleaning") — same Phase CAT idiom as
            # service_posts.py::list_open_posts.
            query = query.ilike("category", _escape_ilike(category.strip()))
        res = query.range(offset, offset + limit - 1).execute()
        items = res.data or []

        # Hide businesses whose owner is ghosted / suspended / soft-deleted.
        hidden_owners = hidden_user_ids(supabase, [b.get("owner_id") for b in items])
        if hidden_owners:
            items = [b for b in items if b.get("owner_id") not in hidden_owners]

        items = _attach_distance(items, lat, lng, None)

        next_offset = offset + limit if len(res.data or []) == limit else None
        return {
            "items": items,
            "limit": limit,
            "offset": offset,
            "next_offset": next_offset,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("list_businesses_error")
        raise HTTPException(status_code=400, detail="Could not list businesses")


@router.get("/{business_id}")
def get_business(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("businesses")
            .select("*")
            .eq("id", business_id)
            .single()
            .execute()
        )
        return res.data
    except Exception:
        raise HTTPException(status_code=404, detail="Business not found")


@router.patch("/{business_id}")
def update_business(
    business_id: str,
    data: BusinessUpdate,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can update a business"
        )

    biz = (
        supabase.table("businesses")
        .select("owner_id")
        .eq("id", business_id)
        .single()
        .execute()
    )
    if not biz.data:
        raise HTTPException(status_code=404, detail="Business not found")
    if biz.data["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You don't own this business")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")
    if update_data.get("category"):
        update_data["category"] = normalize_category(update_data["category"])

    try:
        res = (
            supabase.table("businesses")
            .update(update_data)
            .eq("id", business_id)
            .execute()
        )
        return {"message": "Business updated", "business": res.data[0]}
    except Exception:
        logger.exception("update_business_error")
        raise HTTPException(status_code=400, detail="Could not update business")
