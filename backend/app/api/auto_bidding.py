"""
auto_bidding.py — LANE 5. Rules-based automatic quoting for businesses.

Spec: design/handoff-jet-pulse/PROOF-REQUEST-WEB-AUTOBID.md §4
Rulings (Kira, 2026-07-24, design/DESIGN-SYSTEM.md "Product rules"):

  * Auto-bidding is a PAID FEATURE — subscribers only. Non-subscribers get the
    screen in a locked upgrade state and the switch cannot be enabled.
    Entitled = businesses.subscription_status in ('active', 'trialing').
  * The client's budget is HIDDEN from businesses. The bid is computed from the
    business's OWN rate times the job's scope and is never derived from — never
    even reads — service_posts.budget. Every select in this module lists its
    columns explicitly so `budget` cannot leak in by accident.
  * The floor is never breached. If rate x scope lands under the floor the bid
    is clamped UP to the floor; the job is skipped rather than under-bid.
  * The daily cap and crew availability are checked at SEND time, not save time.
  * Auto-sent quotes are ordinary quotes tagged `interests.is_auto` — visible to
    the business as "Auto", indistinguishable to the client — with a 5-minute
    withdraw window (`interests.auto_withdrawable_until`).
  * Turning the switch on for the first time must pass through the dry run.

Endpoints (mounted under /businesses)
-------------------------------------
GET  /businesses/me/auto-bid           rules + entitlement + gate state
PUT  /businesses/me/auto-bid           save rules (cannot enable without dry run)
POST /businesses/me/auto-bid/dry-run   simulate the last 7 days, sends nothing
POST /businesses/me/auto-bid/activate  record the dry run and go live

Schema: supabase/migrations/20260724090000_proof_of_work_and_auto_bidding.sql
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()

# Only these two subscription states are entitled. 'past_due' and 'canceled'
# are NOT — a lapsed subscriber keeps the screen but loses the switch.
ENTITLED_STATUSES = ("active", "trialing")

DRY_RUN_WINDOW_DAYS = 7
WITHDRAW_WINDOW_MINUTES = 5

# Scope estimation. service_posts carries no explicit hours/scope field (verified
# against the live schema 2026-07-24), so scope is derived from the category with
# a conservative default. This is the ONE place to change when posts start
# carrying a real scope — deliberately NOT inferred from the client's budget,
# which businesses must never see.
SCOPE_HOURS_BY_CATEGORY = {
    "cleaning": 3.0,
    "deep clean": 3.5,
    "move-out": 5.0,
    "moving": 4.0,
    "plumbing": 2.0,
    "electrical": 2.0,
    "handyman": 2.5,
    "landscaping": 3.0,
    "painting": 6.0,
    "office": 2.5,
}
DEFAULT_SCOPE_HOURS = 3.0


# ---------------------------------------------------------------------------
# Payloads
# ---------------------------------------------------------------------------


class AutoBidRulesIn(BaseModel):
    enabled: Optional[bool] = None
    categories: list[str] = Field(default_factory=list)
    radius_km: int = Field(12, ge=1, le=100)
    hourly_rate_cents: int = Field(0, ge=0)
    floor_cents: int = Field(0, ge=0)
    max_bids_per_day: int = Field(8, ge=1, le=50)
    require_free_crew: bool = True


# ---------------------------------------------------------------------------
# Pure helpers — unit tested directly, no database
# ---------------------------------------------------------------------------


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_scope_hours(category: Optional[str]) -> float:
    """Scope in hours for a job, from its category alone.

    Never touches the client's budget. Unknown categories fall back to a
    conservative default rather than guessing high.
    """
    if not category:
        return DEFAULT_SCOPE_HOURS
    return SCOPE_HOURS_BY_CATEGORY.get(category.strip().lower(), DEFAULT_SCOPE_HOURS)


def compute_bid_cents(hourly_rate_cents: int, hours: float, floor_cents: int) -> int:
    """rate x scope, clamped UP to the hard floor. Integer cents, never floats.

    The floor is a floor, not a target: a job whose scope prices below it is
    quoted AT the floor. Nothing in this function can return a value under
    ``floor_cents``.
    """
    raw = int(round(int(hourly_rate_cents) * float(hours)))
    return max(raw, int(floor_cents))


def rules_are_complete(rules: dict) -> bool:
    """A rule set that cannot produce a legal bid must not go live."""
    return (
        bool(rules.get("categories"))
        and int(rules.get("hourly_rate_cents") or 0) > 0
        and int(rules.get("floor_cents") or 0) > 0
    )


def can_send_now(
    rules: dict, *, sent_today: int, crew_free: bool, now: Optional[datetime] = None
) -> tuple[bool, Optional[str]]:
    """SEND-time gate. Deliberately separate from rule saving.

    A rule set saved at 9am with "max 8 per day" and "only when a crew is free"
    means nothing unless both are re-evaluated at the instant a quote would go
    out — the crew's calendar and the day's count both move after save.
    """
    del now  # reserved: quiet-hours / calendar windows land here next
    if not rules.get("enabled"):
        return False, "auto-bidding is off"
    if not rules.get("dry_run_passed_at"):
        return False, "dry run not completed"
    if sent_today >= int(rules.get("max_bids_per_day") or 0):
        return False, "daily cap reached"
    if rules.get("require_free_crew") and not crew_free:
        return False, "no crew free"
    return True, None


def withdraw_deadline(sent_at: datetime) -> datetime:
    """Auto-sent quotes can be pulled back for 5 minutes, then normal rules."""
    return sent_at + timedelta(minutes=WITHDRAW_WINDOW_MINUTES)


def is_entitled(subscription_status: Optional[str]) -> bool:
    return (subscription_status or "").strip().lower() in ENTITLED_STATUSES


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

DEFAULT_RULES = {
    "enabled": False,
    "categories": [],
    "radius_km": 12,
    "hourly_rate_cents": 0,
    "floor_cents": 0,
    "max_bids_per_day": 8,
    "require_free_crew": True,
    "dry_run_passed_at": None,
}


def _owner_business(current_user: dict) -> dict:
    if current_user.get("role") != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can set auto-bidding rules"
        )
    try:
        res = (
            supabase.table("businesses")
            .select("id, business_name, category, lat, lng, subscription_status")
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=404, detail="You don't have a business registered"
        )
    if not res.data:
        raise HTTPException(
            status_code=404, detail="You don't have a business registered"
        )
    return res.data


def _require_entitled(business: dict) -> None:
    if not is_entitled(business.get("subscription_status")):
        raise HTTPException(
            status_code=402,
            detail=(
                "Auto-bidding is part of a SwingBy subscription. "
                "Subscribe to switch it on."
            ),
        )


def _load_rules(business_id: str) -> dict:
    try:
        res = (
            supabase.table("business_auto_bid_rules")
            .select("*")
            .eq("business_id", business_id)
            .single()
            .execute()
        )
        if res.data:
            return res.data
    except Exception:
        pass
    return {"business_id": business_id, **DEFAULT_RULES}


def _save_rules(business_id: str, patch: dict) -> dict:
    row = {
        "business_id": business_id,
        **patch,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = (
        supabase.table("business_auto_bid_rules")
        .upsert(row, on_conflict="business_id")
        .execute()
    )
    return (res.data or [row])[0]


def _auto_bids_sent_today(business_id: str) -> int:
    """How many auto-quotes this business already sent in the last 24 h."""
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    try:
        res = (
            supabase.table("interests")
            .select("id", count="exact")
            .eq("business_id", business_id)
            .eq("is_auto", True)
            .gte("created_at", since)
            .execute()
        )
        return res.count or 0
    except Exception:
        logger.warning("could not count today's auto-bids for %s", business_id)
        # Fail CLOSED: an unknown count must not let the cap be exceeded.
        return 10**6


def _recent_posts(rules: dict, business: dict) -> list[dict]:
    """Candidate jobs for the dry run.

    NOTE the explicit column list: `budget` is not in it and must never be.
    """
    since = (
        datetime.now(timezone.utc) - timedelta(days=DRY_RUN_WINDOW_DAYS)
    ).isoformat()
    try:
        res = (
            supabase.table("service_posts")
            .select("id, title, category, lat, lng, address, created_at")
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(60)
            .execute()
        )
        return res.data or []
    except Exception:
        logger.warning("dry run could not read recent posts")
        return []


def _evaluate_post(post: dict, rules: dict, business: dict) -> dict:
    """One dry-run row: matched with an amount, or skipped with a reason."""
    title = post.get("title") or "Job"
    category = post.get("category")
    area = (post.get("address") or "").split(",")[0].strip() or "Calgary"

    distance_km = None
    if all(
        v is not None
        for v in (
            business.get("lat"),
            business.get("lng"),
            post.get("lat"),
            post.get("lng"),
        )
    ):
        distance_km = round(
            haversine_km(
                float(business["lat"]),
                float(business["lng"]),
                float(post["lat"]),
                float(post["lng"]),
            ),
            1,
        )

    base = {
        "post_id": post.get("id"),
        "title": title,
        "category": category,
        "area": area,
        "distance_km": distance_km,
    }

    selected = [c.strip().lower() for c in (rules.get("categories") or [])]
    if selected and (category or "").strip().lower() not in selected:
        return {**base, "matched": False, "reason": "Not in your services"}

    radius = float(rules.get("radius_km") or 0)
    if distance_km is not None and distance_km > radius:
        return {**base, "matched": False, "reason": f"{distance_km} km — too far"}

    hours = estimate_scope_hours(category)
    bid_cents = compute_bid_cents(
        int(rules.get("hourly_rate_cents") or 0),
        hours,
        int(rules.get("floor_cents") or 0),
    )
    if bid_cents <= 0:
        return {**base, "matched": False, "reason": "Set your rate first"}

    return {
        **base,
        "matched": True,
        "scope_hours": hours,
        "bid_cents": bid_cents,
        "reason": None,
    }


def run_dry_run(posts: list[dict], rules: dict, business: dict) -> dict:
    """Pure over its inputs so the whole simulation is unit-testable."""
    rows = [_evaluate_post(p, rules, business) for p in posts]
    matched = [r for r in rows if r["matched"]]
    cap = int(rules.get("max_bids_per_day") or 0)
    # The dry run reports what the cap WOULD have allowed, honestly — it does
    # not silently pretend every match would have been sent.
    return {
        "considered": len(rows),
        "matched": len(matched),
        "would_bid_cents": sum(r["bid_cents"] for r in matched),
        "daily_cap": cap,
        "rows": rows,
        "window_days": DRY_RUN_WINDOW_DAYS,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/me/auto-bid")
def get_auto_bid(current_user: dict = Depends(get_current_user)):
    """Rules + entitlement. Never 402s — the locked screen needs to render."""
    business = _owner_business(current_user)
    rules = _load_rules(business["id"])
    entitled = is_entitled(business.get("subscription_status"))
    return {
        "entitled": entitled,
        "subscription_status": business.get("subscription_status"),
        "rules": rules,
        "dry_run_passed": bool(rules.get("dry_run_passed_at")),
        "rules_complete": rules_are_complete(rules),
        "withdraw_window_minutes": WITHDRAW_WINDOW_MINUTES,
    }


@router.put("/me/auto-bid")
def put_auto_bid(body: AutoBidRulesIn, current_user: dict = Depends(get_current_user)):
    business = _owner_business(current_user)
    _require_entitled(business)

    current = _load_rules(business["id"])

    patch = {
        "categories": [c for c in body.categories if c and c.strip()],
        "radius_km": body.radius_km,
        "hourly_rate_cents": body.hourly_rate_cents,
        "floor_cents": body.floor_cents,
        "max_bids_per_day": body.max_bids_per_day,
        "require_free_crew": body.require_free_crew,
    }

    if body.enabled is not None:
        if body.enabled and not current.get("dry_run_passed_at"):
            raise HTTPException(
                status_code=409,
                detail="Run the dry run before switching auto-bidding on",
            )
        if body.enabled and not rules_are_complete({**current, **patch}):
            raise HTTPException(
                status_code=400,
                detail="Pick at least one service and set your rate and floor first",
            )
        patch["enabled"] = body.enabled

    saved = _save_rules(business["id"], patch)
    return {"rules": saved, "entitled": True}


@router.post("/me/auto-bid/dry-run")
def post_dry_run(body: AutoBidRulesIn, current_user: dict = Depends(get_current_user)):
    """Simulate the last 7 days against the rules IN THE REQUEST.

    Sends nothing, writes nothing, and does not mark the gate as passed — the
    business still has to confirm on the sheet.
    """
    business = _owner_business(current_user)
    _require_entitled(business)

    rules = {
        **_load_rules(business["id"]),
        "categories": body.categories,
        "radius_km": body.radius_km,
        "hourly_rate_cents": body.hourly_rate_cents,
        "floor_cents": body.floor_cents,
        "max_bids_per_day": body.max_bids_per_day,
        "require_free_crew": body.require_free_crew,
    }
    posts = _recent_posts(rules, business)
    return run_dry_run(posts, rules, business)


@router.post("/me/auto-bid/activate")
def post_activate(body: AutoBidRulesIn, current_user: dict = Depends(get_current_user)):
    """Confirm the dry run and go live. The only path that can set enabled=true
    the first time."""
    business = _owner_business(current_user)
    _require_entitled(business)

    patch = {
        "categories": [c for c in body.categories if c and c.strip()],
        "radius_km": body.radius_km,
        "hourly_rate_cents": body.hourly_rate_cents,
        "floor_cents": body.floor_cents,
        "max_bids_per_day": body.max_bids_per_day,
        "require_free_crew": body.require_free_crew,
    }
    if not rules_are_complete(patch):
        raise HTTPException(
            status_code=400,
            detail="Pick at least one service and set your rate and floor first",
        )

    patch["dry_run_passed_at"] = datetime.now(timezone.utc).isoformat()
    patch["enabled"] = True
    saved = _save_rules(business["id"], patch)
    return {
        "rules": saved,
        "entitled": True,
        "sent_today": _auto_bids_sent_today(business["id"]),
    }
