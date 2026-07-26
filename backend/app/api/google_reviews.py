"""
google_reviews.py — LANE D. Import a business owner's OWN verified Google
reviews at signup so nobody starts at zero (walkthrough item M3).

Schema: supabase/migrations/20260725210000_google_business_reviews_import.sql

═══════════════════════════════════════════════════════════════════════════════
BUILT DARK — READ THIS BEFORE CHANGING ANYTHING
═══════════════════════════════════════════════════════════════════════════════
The Google Business Profile API family is gated behind a MANUAL Google approval
(the "Business Profile APIs" access request) that has NOT been granted to this
project yet, and takes weeks. So this module is written against the real APIs
and real OAuth endpoints, but every path that talks to Google is behind the
`GOOGLE_REVIEWS_ENABLED` env flag, DEFAULT OFF.

  flag OFF → GET /google-reviews/status answers {"enabled": false, ...} and the
             mobile UI renders a calm "coming soon" card. Every write path
             answers 503 with an explanatory detail. Nothing is broken, nothing
             half-renders, no button leads to an error.
  flag ON  → the same code path runs for real against Google.

Nothing here was exercised against live Google. It is covered by
backend/tests/test_google_reviews.py with mocked Google responses whose shapes
come from Google's published API references.

═══════════════════════════════════════════════════════════════════════════════
TRUST RULES (non-negotiable — this is a trust marketplace)
═══════════════════════════════════════════════════════════════════════════════
1. NO FABRICATION. There is exactly one writer of `business_imported_reviews`:
   `_import_reviews_for_location`, and it writes only what the Business Profile
   API returned for a location the connected Google account is an owner/manager
   of. No seeding, no fixtures-into-production, no demo rows, no scraping.
   Scraping Google breaches their ToS and would make every imported review a
   lie about its own provenance.
2. NO CHERRY-PICKING. An import takes EVERY review the chosen location has, not
   just the flattering ones. "Curated" in the product ask means "genuinely from
   your own verified profile", not "the good ones". Letting an owner import
   their 5-star reviews and drop their 1-stars would be a lie told with true
   sentences, and it is the reason this module exposes no rating filter.
3. NEVER BLENDED. Imported reviews live in their own table and never touch
   `reviews`, `businesses.avg_rating` or `businesses.review_count`. The SwingBy
   rating keeps meaning "rated on a job SwingBy escrowed and completed". The
   API returns imported reviews under their own key with `source` and
   `verified` on every row so the client can label them, and the mobile UI
   labels them visibly. See the migration header for the full argument.
4. OWNERSHIP IS SERVER-SIDE. No endpoint accepts a `business_id` to write to.
   The target business is always resolved from the authenticated caller via
   `businesses.owner_id = current_user.id`.

═══════════════════════════════════════════════════════════════════════════════
SEPARATE FROM SIGN-IN OAUTH
═══════════════════════════════════════════════════════════════════════════════
app/api/auth.py already runs a Google OAuth flow — that is SIGN-IN, mediated by
Supabase Auth, with identity scopes, and it produces a SwingBy session. This is
a different consent entirely: the `business.manage` scope, a different Google
Cloud client, tokens we hold ourselves, and it produces no session. A business
owner who signed in with Google has NOT granted this. The two must not be
merged — a user must be able to revoke review access without losing their
login, and signing in must never silently hand us their Business Profile.

═══════════════════════════════════════════════════════════════════════════════
ENV VARS (all read via os.getenv — app/config.py is not owned by this module,
adding them to its _OPTIONAL list is a follow-up nicety, same as auth.py does
for SOCIAL_AUTH_REDIRECT_PREFIXES)
═══════════════════════════════════════════════════════════════════════════════
  GOOGLE_REVIEWS_ENABLED         "1"/"true"/"yes"/"on" to switch the feature on.
                                 Absent or anything else = OFF. Leave OFF until
                                 Google grants Business Profile API access.
  GOOGLE_BUSINESS_CLIENT_ID      OAuth 2.0 client id from Google Cloud.
  GOOGLE_BUSINESS_CLIENT_SECRET  Its secret. Omit for an installed-app (mobile)
                                 client type, which is PKCE-only and has none.
  GOOGLE_BUSINESS_REDIRECT_URI   Default redirect_uri when the app sends none.
  GOOGLE_BUSINESS_REDIRECT_PREFIXES
                                 Extra comma-separated allowlist prefixes for
                                 redirect_uri, on top of swingby:// and
                                 https://swingbyy.com/.

NO SECRET IS READ FROM, OR WRITTEN TO, ANY FILE IN THIS REPO.

Endpoints (mounted under /google-reviews)
-----------------------------------------
GET    /google-reviews/status                 owner: flag + connection state
POST   /google-reviews/connect                owner: begin consent → auth URL
GET    /google-reviews/callback               Google's browser landing (bridge)
POST   /google-reviews/callback               owner: exchange code → tokens
GET    /google-reviews/locations              owner: their GBP locations
POST   /google-reviews/import                 owner: idempotent review import
DELETE /google-reviews/disconnect             owner: revoke + forget
GET    /google-reviews/business/{id}          anyone signed in: labelled reviews
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, field_validator

from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


# ═════════════════════════════════════════════════════════════════════════════
# Google endpoints — the real ones
# ═════════════════════════════════════════════════════════════════════════════

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"

# Account Management API — lists the accounts (personal + location groups) the
# authenticated user administers.
GBP_ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"

# Business Information API — lists locations under an account. `readMask` is
# REQUIRED by this API; omitting it is a 400.
GBP_LOCATIONS_URL = "https://mybusinessbusinessinformation.googleapis.com/v1"
GBP_LOCATIONS_READ_MASK = "name,title,storefrontAddress"

# Reviews still live on the v4 My Business API — they were never migrated to
# the split v1 APIs. Parent is "accounts/{a}/locations/{l}".
GBP_REVIEWS_URL = "https://mybusiness.googleapis.com/v4"

# The single scope this feature needs. Read/write on the profile is the only
# grain Google offers; we only ever GET.
GBP_SCOPE = "https://www.googleapis.com/auth/business.manage"

HTTP_TIMEOUT_SECONDS = 15.0

# Hard ceiling on one import so a location with thousands of reviews cannot
# turn a single tap into an unbounded paginated crawl.
MAX_REVIEWS_PER_IMPORT = 200
REVIEWS_PAGE_SIZE = 50

# Google's star enum → integer. STAR_RATING_UNSPECIFIED has no honest integer,
# so those rows are skipped rather than guessed at.
_STAR_RATINGS = {
    "ONE": 1,
    "TWO": 2,
    "THREE": 3,
    "FOUR": 4,
    "FIVE": 5,
}

# Redirect targets we will hand a Google auth code to. Same reasoning as
# auth.py's `_allowed_redirect_prefixes`: an open redirect here would let an
# attacker harvest OAuth codes, so this is an allowlist of prefixes.
_DEFAULT_REDIRECT_PREFIXES = ("swingby://", "https://swingbyy.com/")

_TRUTHY = {"1", "true", "yes", "on", "enabled"}


# ═════════════════════════════════════════════════════════════════════════════
# Feature flag + config
# ═════════════════════════════════════════════════════════════════════════════


def google_reviews_enabled() -> bool:
    """The dark switch. Read at CALL time, never cached at import time.

    Deliberately not memoised: a cached value would mean the day Google grants
    access, flipping the env var on Render would need a code deploy to take
    effect rather than the restart the platform already does.
    """
    return os.getenv("GOOGLE_REVIEWS_ENABLED", "").strip().lower() in _TRUTHY


def _client_id() -> str:
    return os.getenv("GOOGLE_BUSINESS_CLIENT_ID", "").strip()


def _client_secret() -> str:
    return os.getenv("GOOGLE_BUSINESS_CLIENT_SECRET", "").strip()


def _default_redirect_uri() -> str:
    return os.getenv("GOOGLE_BUSINESS_REDIRECT_URI", "").strip()


def _allowed_redirect_prefixes() -> Tuple[str, ...]:
    extra = os.getenv("GOOGLE_BUSINESS_REDIRECT_PREFIXES", "")
    parsed = tuple(p.strip() for p in extra.split(",") if p.strip())
    configured = _default_redirect_uri()
    base = _DEFAULT_REDIRECT_PREFIXES + parsed
    return base + ((configured,) if configured else ())


def _require_enabled() -> None:
    """Guard every path that would talk to Google or write imported rows.

    503 (not 404) on purpose: the feature exists and is coming, the server just
    cannot serve it yet. The mobile client keys its "coming soon" state off
    GET /status rather than off this error, so a user should never see it —
    it is the backstop for a stale client build.
    """
    if not google_reviews_enabled():
        raise HTTPException(
            status_code=503,
            detail=(
                "Google review import isn't switched on yet. It unlocks once "
                "Google approves SwingBy's Business Profile API access."
            ),
        )


def _require_google_client() -> str:
    client_id = _client_id()
    if not client_id:
        # Flag on but credentials missing is a deployment mistake, and it is
        # worth saying so precisely rather than failing at Google with an
        # opaque invalid_client.
        logger.error(
            "GOOGLE_REVIEWS_ENABLED is on but GOOGLE_BUSINESS_CLIENT_ID is "
            "not set — the connect flow cannot start."
        )
        raise HTTPException(
            status_code=503,
            detail="Google connection isn't configured on this server yet.",
        )
    return client_id


# ═════════════════════════════════════════════════════════════════════════════
# Small helpers
# ═════════════════════════════════════════════════════════════════════════════


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _pkce_pair() -> Tuple[str, str]:
    """(code_verifier, code_challenge) for RFC 7636 S256.

    The verifier never leaves the server — unlike auth.py's sign-in flow, which
    hands it to the app, here the backend holds both ends of the round trip, so
    it is parked in business_google_oauth_states and consumed once.
    """
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).decode().rstrip("=")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode().rstrip("=")
    return verifier, challenge


def _validate_redirect(value: str, field: str = "redirect_uri") -> str:
    value = (value or "").strip()
    if not value or not any(
        value.startswith(p) for p in _allowed_redirect_prefixes() if p
    ):
        raise HTTPException(status_code=400, detail=f"{field} is not allowed")
    return value


def _parse_google_time(raw: Optional[str]) -> Optional[str]:
    """Google RFC 3339 → an ISO string PostgREST accepts, or None.

    Tolerant on purpose: a timestamp we cannot parse must not fail an entire
    import. The review is still real; it just sorts by import time instead.
    """
    if not raw:
        return None
    text = str(raw).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    # Google sometimes emits nanosecond precision; datetime tops out at micro.
    if "." in text:
        head, _, tail = text.partition(".")
        digits = ""
        for ch in tail:
            if ch.isdigit():
                digits += ch
            else:
                tail = tail[len(digits) :]
                break
        else:
            tail = ""
        text = f"{head}.{digits[:6]}{tail}" if digits else head + tail
    try:
        return datetime.fromisoformat(text).astimezone(timezone.utc).isoformat()
    except ValueError:
        logger.warning("Unparseable Google timestamp %r — left null", raw)
        return None


def _owner_business(current_user: dict) -> dict:
    """The caller's OWN business, or an error. The only way to name a target.

    No endpoint in this module takes a business_id for a write, so this is the
    single point where "which business" is decided, and it is decided from the
    JWT. A business owner cannot import into someone else's profile because
    there is no argument through which they could name it.
    """
    if current_user.get("role") != "business_owner":
        raise HTTPException(
            status_code=403,
            detail="Only business owners can connect a Google Business Profile",
        )
    try:
        res = (
            supabase.table("businesses")
            .select("id, business_name, owner_id")
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


def _load_connection(business_id: str) -> Optional[dict]:
    try:
        res = (
            supabase.table("business_google_connections")
            .select("*")
            .eq("business_id", business_id)
            .single()
            .execute()
        )
        return res.data or None
    except Exception:
        # .single() raises when there is no row — that is "not connected".
        return None


def _require_connection(business_id: str) -> dict:
    conn = _load_connection(business_id)
    if not conn or conn.get("status") == "revoked":
        raise HTTPException(
            status_code=409,
            detail="Connect your Google Business Profile first",
        )
    return conn


def _save_connection(business_id: str, patch: dict) -> None:
    supabase.table("business_google_connections").update(
        {**patch, "updated_at": _now_iso()}
    ).eq("business_id", business_id).execute()


# ═════════════════════════════════════════════════════════════════════════════
# Google HTTP plumbing
# ═════════════════════════════════════════════════════════════════════════════


def _google_error(action: str, exc: Exception) -> HTTPException:
    logger.exception("Google Business Profile call failed during %s", action)
    return HTTPException(
        status_code=502,
        detail="Google couldn't be reached just now. Try again in a moment.",
    )


def _post_token(payload: Dict[str, str], action: str) -> dict:
    """POST to Google's token endpoint. Returns the parsed body.

    The client secret is attached only when one is configured — an installed-app
    (Android/iOS) OAuth client type has no secret and PKCE alone authenticates
    the exchange. Sending an empty secret would be rejected as invalid_client.
    """
    secret = _client_secret()
    if secret:
        payload = {**payload, "client_secret": secret}
    try:
        resp = httpx.post(GOOGLE_TOKEN_URL, data=payload, timeout=HTTP_TIMEOUT_SECONDS)
    except Exception as exc:
        raise _google_error(action, exc)

    if resp.status_code >= 400:
        # Log Google's error CODE (invalid_grant, invalid_client…) but never the
        # body verbatim — it echoes request parameters back.
        code = ""
        try:
            code = str((resp.json() or {}).get("error", ""))
        except Exception:
            code = f"http_{resp.status_code}"
        logger.error("Google token endpoint refused %s: %s", action, code)
        raise HTTPException(
            status_code=400,
            detail=(
                "Google turned down that connection attempt. "
                "Start the connect flow again."
            ),
        )
    try:
        return resp.json() or {}
    except Exception as exc:
        raise _google_error(action, exc)


def _google_get(url: str, access_token: str, params: Optional[dict] = None) -> dict:
    try:
        resp = httpx.get(
            url,
            params=params or {},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=HTTP_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        raise _google_error(url, exc)

    if resp.status_code in (401, 403):
        raise HTTPException(
            status_code=409,
            detail=(
                "Google no longer accepts SwingBy's access to that profile. "
                "Reconnect your Google account."
            ),
        )
    if resp.status_code >= 400:
        logger.error("Google API %s returned HTTP %s", url, resp.status_code)
        raise HTTPException(
            status_code=502,
            detail="Google couldn't return your profile just now.",
        )
    try:
        return resp.json() or {}
    except Exception as exc:
        raise _google_error(url, exc)


def _ensure_access_token(connection: dict) -> str:
    """A usable access token, refreshing first if it is expired or about to be.

    Google access tokens last an hour; a 120 s skew means a token that would
    die mid-import gets replaced before the import rather than during it.
    """
    expires_at = connection.get("token_expires_at")
    token = connection.get("access_token") or ""
    still_valid = False
    if token and expires_at:
        parsed = _parse_google_time(expires_at)
        if parsed:
            still_valid = (
                datetime.fromisoformat(parsed) - timedelta(seconds=120) > _now()
            )
    if still_valid:
        return token

    refresh_token = connection.get("refresh_token")
    if not refresh_token:
        _save_connection(connection["business_id"], {"status": "needs_reauth"})
        raise HTTPException(
            status_code=409,
            detail="Your Google connection expired. Reconnect to keep importing.",
        )

    body = _post_token(
        {
            "client_id": _require_google_client(),
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        "token refresh",
    )
    new_token = body.get("access_token")
    if not new_token:
        _save_connection(connection["business_id"], {"status": "needs_reauth"})
        raise HTTPException(
            status_code=409,
            detail="Your Google connection expired. Reconnect to keep importing.",
        )

    expiry = _now() + timedelta(seconds=int(body.get("expires_in") or 3600))
    _save_connection(
        connection["business_id"],
        {"access_token": new_token, "token_expires_at": expiry.isoformat()},
    )
    connection["access_token"] = new_token
    connection["token_expires_at"] = expiry.isoformat()
    return new_token


# ═════════════════════════════════════════════════════════════════════════════
# Google Business Profile reads
# ═════════════════════════════════════════════════════════════════════════════


def _list_accounts(access_token: str) -> List[dict]:
    body = _google_get(GBP_ACCOUNTS_URL, access_token, {"pageSize": 20})
    return list(body.get("accounts") or [])


def _list_locations(access_token: str) -> List[dict]:
    """Every location under every account the connected user administers.

    Returned `name` is normalised to the FULL "accounts/{a}/locations/{l}"
    resource path, because that — not the bare "locations/{l}" the Business
    Information API returns — is what the v4 reviews endpoint takes as parent.
    """
    out: List[dict] = []
    for account in _list_accounts(access_token):
        account_name = account.get("name") or ""
        if not account_name:
            continue
        page_token = None
        while True:
            params = {
                "readMask": GBP_LOCATIONS_READ_MASK,
                "pageSize": 100,
            }
            if page_token:
                params["pageToken"] = page_token
            body = _google_get(
                f"{GBP_LOCATIONS_URL}/{account_name}/locations",
                access_token,
                params,
            )
            for loc in body.get("locations") or []:
                bare = loc.get("name") or ""
                if not bare:
                    continue
                full = (
                    bare if bare.startswith("accounts/") else f"{account_name}/{bare}"
                )
                address = loc.get("storefrontAddress") or {}
                lines = list(address.get("addressLines") or [])
                locality = address.get("locality") or ""
                out.append(
                    {
                        "name": full,
                        "title": loc.get("title") or "Untitled location",
                        "address": ", ".join([x for x in lines + [locality] if x]),
                        "account": account_name,
                        "account_name": account.get("accountName") or "",
                    }
                )
            page_token = body.get("nextPageToken")
            if not page_token:
                break
    return out


def _fetch_reviews(access_token: str, location: str) -> Tuple[List[dict], dict]:
    """Every review for `location`, plus Google's own summary.

    Paginated to MAX_REVIEWS_PER_IMPORT. No filtering happens here or anywhere
    else — see trust rule 2 in the module docstring.
    """
    reviews: List[dict] = []
    summary: dict = {}
    page_token = None
    while len(reviews) < MAX_REVIEWS_PER_IMPORT:
        params: Dict[str, Any] = {"pageSize": REVIEWS_PAGE_SIZE}
        if page_token:
            params["pageToken"] = page_token
        body = _google_get(
            f"{GBP_REVIEWS_URL}/{location}/reviews", access_token, params
        )
        if not summary:
            summary = {
                "google_average_rating": body.get("averageRating"),
                "google_total_review_count": body.get("totalReviewCount"),
            }
        batch = body.get("reviews") or []
        reviews.extend(batch)
        page_token = body.get("nextPageToken")
        if not page_token or not batch:
            break
    return reviews[:MAX_REVIEWS_PER_IMPORT], summary


def _to_row(
    review: dict, business_id: str, location: str, user_id: str
) -> Optional[dict]:
    """One Google review → one storable row, or None if it isn't storable.

    `verified` is hard-coded True here and nowhere else. It is true by
    construction: this function is only ever reached with a payload that came
    back from an OAuth-authenticated read of a location the connected account
    administers. It is never derived from anything the caller sent.
    """
    external_id = (review.get("reviewId") or "").strip()
    rating = _STAR_RATINGS.get(str(review.get("starRating") or "").upper())
    if not external_id or not rating:
        # No stable id, or a rating Google itself calls unspecified. Skipped
        # rather than invented — a guessed star is a fabricated star.
        return None

    reviewer = review.get("reviewer") or {}
    if reviewer.get("isAnonymous"):
        author = "Google user"
        photo = None
    else:
        author = (reviewer.get("displayName") or "Google user").strip()
        photo = (reviewer.get("profilePhotoUrl") or "").strip() or None

    comment = review.get("comment")
    comment = comment.strip() if isinstance(comment, str) else None

    return {
        "business_id": business_id,
        "source": "google",
        "external_review_id": external_id,
        "external_location": location,
        "author_name": author[:120],
        "author_photo_url": photo[:2048] if photo else None,
        "rating": rating,
        "comment": comment,
        "reviewed_at": _parse_google_time(review.get("createTime")),
        "review_updated_at": _parse_google_time(review.get("updateTime")),
        "verified": True,
        "imported_by": user_id,
        "updated_at": _now_iso(),
    }


def _import_reviews_for_location(
    business_id: str, location: str, user_id: str, access_token: str
) -> dict:
    """THE ONLY WRITER of business_imported_reviews. Idempotent by construction.

    Idempotency is the UNIQUE (business_id, source, external_review_id)
    constraint from the migration plus an upsert on that conflict target, so a
    second import of the same location refreshes rows in place. The
    imported/updated split is computed by diffing against the external ids
    already stored, purely so the owner gets an honest "3 new" message.
    """
    raw_reviews, summary = _fetch_reviews(access_token, location)

    rows: List[dict] = []
    seen: set[str] = set()
    for review in raw_reviews:
        row = _to_row(review, business_id, location, user_id)
        if not row:
            continue
        # Google has, on occasion, returned the same review twice across page
        # boundaries. Upsert would handle it; de-duping first keeps the
        # new-vs-updated counts honest.
        if row["external_review_id"] in seen:
            continue
        seen.add(row["external_review_id"])
        rows.append(row)

    existing = (
        supabase.table("business_imported_reviews")
        .select("external_review_id")
        .eq("business_id", business_id)
        .eq("source", "google")
        .execute()
    )
    existing_ids = {
        r.get("external_review_id")
        for r in (existing.data or [])
        if isinstance(r, dict)
    }

    if rows:
        supabase.table("business_imported_reviews").upsert(
            rows, on_conflict="business_id,source,external_review_id"
        ).execute()

    new_count = len([r for r in rows if r["external_review_id"] not in existing_ids])
    return {
        "imported": new_count,
        "updated": len(rows) - new_count,
        "total": len(rows),
        "skipped": len(raw_reviews) - len(rows),
        **summary,
    }


# ═════════════════════════════════════════════════════════════════════════════
# Read model shared by the owner and the client-facing profile
# ═════════════════════════════════════════════════════════════════════════════


def _imported_reviews(business_id: str) -> List[dict]:
    try:
        res = (
            supabase.table("business_imported_reviews")
            .select(
                "id, source, external_review_id, author_name, author_photo_url, "
                "rating, comment, reviewed_at, verified, imported_at"
            )
            .eq("business_id", business_id)
            .order("reviewed_at", desc=True)
            .execute()
        )
        return list(res.data or [])
    except Exception:
        logger.exception("Could not read imported reviews for business %s", business_id)
        return []


def _summarise(rows: List[dict]) -> dict:
    ratings = [r["rating"] for r in rows if isinstance(r.get("rating"), int)]
    return {
        "count": len(rows),
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
    }


# ═════════════════════════════════════════════════════════════════════════════
# Schemas
# ═════════════════════════════════════════════════════════════════════════════


class ConnectStart(BaseModel):
    # Where Google should send the browser back to. Defaults to
    # GOOGLE_BUSINESS_REDIRECT_URI when the app doesn't say.
    redirect_uri: Optional[str] = Field(None, max_length=512)
    # Where the GET bridge should forward the code to (deep link back into the
    # app) when Google's redirect lands on the backend rather than the app.
    app_redirect: Optional[str] = Field(None, max_length=512)


class ConnectCallback(BaseModel):
    code: str = Field(..., min_length=1, max_length=2048)
    state: str = Field(..., min_length=1, max_length=256)

    @field_validator("code", "state", mode="before")
    @classmethod
    def _strip(cls, v):
        return str(v).strip() if v is not None else v


class ImportRequest(BaseModel):
    # A Google resource name, "accounts/{a}/locations/{l}". NOT a SwingBy id —
    # there is deliberately no business_id on this model.
    location: str = Field(..., min_length=1, max_length=256)

    @field_validator("location")
    @classmethod
    def _looks_like_a_location(cls, v: str) -> str:
        v = v.strip()
        if "locations/" not in v:
            raise ValueError("location must be a Google location resource name")
        return v


# ═════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═════════════════════════════════════════════════════════════════════════════


@router.get("/status")
def google_reviews_status(current_user: dict = Depends(get_current_user)):
    """What the business-setup / business-profile UI keys its whole state off.

    Answers even when the flag is off — that is the point. `enabled: false` is
    what makes the app render "coming soon" instead of a button that 503s.
    """
    business = _owner_business(current_user)
    rows = _imported_reviews(business["id"])
    summary = _summarise(rows)

    if not google_reviews_enabled():
        return {
            "enabled": False,
            "connected": False,
            "status": "coming_soon",
            "imported_count": summary["count"],
            "imported_average_rating": summary["average_rating"],
            "message": (
                "Bringing your Google reviews across is coming soon — we're "
                "waiting on Google to approve SwingBy's access."
            ),
        }

    conn = _load_connection(business["id"])
    connected = bool(conn and conn.get("status") == "connected")
    return {
        "enabled": True,
        "connected": connected,
        "status": (conn or {}).get("status") or "not_connected",
        "google_account_email": (conn or {}).get("google_account_email"),
        "selected_location": (conn or {}).get("selected_location"),
        "selected_location_title": (conn or {}).get("selected_location_title"),
        "last_import_at": (conn or {}).get("last_import_at"),
        "imported_count": summary["count"],
        "imported_average_rating": summary["average_rating"],
    }


@router.post("/connect")
def start_google_connect(
    data: ConnectStart, current_user: dict = Depends(get_current_user)
):
    """Begin the Business Profile consent. Returns a URL for the app to open."""
    _require_enabled()
    client_id = _require_google_client()
    business = _owner_business(current_user)

    redirect_uri = _validate_redirect(data.redirect_uri or _default_redirect_uri())
    app_redirect = (
        _validate_redirect(data.app_redirect, "app_redirect")
        if data.app_redirect
        else None
    )

    verifier, challenge = _pkce_pair()
    state = secrets.token_urlsafe(32)

    supabase.table("business_google_oauth_states").insert(
        {
            "state": state,
            "business_id": business["id"],
            "user_id": current_user["id"],
            "code_verifier": verifier,
            "redirect_uri": redirect_uri,
            "app_redirect": app_redirect,
            "expires_at": (_now() + timedelta(minutes=15)).isoformat(),
        }
    ).execute()

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": GBP_SCOPE,
        # offline + consent is what gets us a refresh token. Without `consent`
        # Google withholds the refresh token on every grant after the first,
        # and the connection silently dies an hour later.
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return {
        "authorization_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}",
        "state": state,
        "redirect_uri": redirect_uri,
    }


@router.get("/callback")
def google_connect_bridge(
    state: str = Query(""),
    code: str = Query(""),
    error: str = Query(""),
):
    """Google's browser landing when redirect_uri points at this backend.

    UNAUTHENTICATED and deliberately dumb: it forwards the opaque code+state to
    the app's deep link and does nothing else. All real work needs the caller's
    JWT and happens in POST /callback. If no app_redirect was recorded, it says
    so in plain text rather than guessing at a destination.
    """
    row = None
    if state:
        try:
            res = (
                supabase.table("business_google_oauth_states")
                .select("app_redirect")
                .eq("state", state)
                .single()
                .execute()
            )
            row = res.data
        except Exception:
            row = None

    target = (row or {}).get("app_redirect")
    if not target:
        return {
            "status": "error" if error else "ok",
            "detail": (
                "Return to the SwingBy app to finish connecting your Google "
                "Business Profile."
            ),
        }

    sep = "&" if "?" in target else "?"
    query = urlencode(
        {k: v for k, v in (("code", code), ("state", state), ("error", error)) if v}
    )
    return RedirectResponse(url=f"{target}{sep}{query}", status_code=302)


@router.post("/callback")
def finish_google_connect(
    data: ConnectCallback, current_user: dict = Depends(get_current_user)
):
    """Exchange the auth code for tokens and record the connection."""
    _require_enabled()
    client_id = _require_google_client()
    business = _owner_business(current_user)

    try:
        state_res = (
            supabase.table("business_google_oauth_states")
            .select("*")
            .eq("state", data.state)
            .single()
            .execute()
        )
        state_row = state_res.data
    except Exception:
        state_row = None

    if not state_row:
        raise HTTPException(status_code=400, detail="That connection attempt expired")

    # THE AUTH BOUNDARY. The state row remembers who started the flow and for
    # which business. A code obtained in someone else's browser cannot be
    # redeemed against this caller's business, and this caller cannot redeem a
    # state that belongs to another owner.
    if (
        state_row.get("user_id") != current_user["id"]
        or state_row.get("business_id") != business["id"]
    ):
        raise HTTPException(
            status_code=403, detail="That connection attempt isn't yours"
        )

    if state_row.get("used_at"):
        raise HTTPException(status_code=400, detail="That connection attempt expired")

    expires_at = _parse_google_time(state_row.get("expires_at"))
    if expires_at and datetime.fromisoformat(expires_at) < _now():
        raise HTTPException(status_code=400, detail="That connection attempt expired")

    # Burn the state BEFORE the exchange — if the exchange fails the owner
    # starts a fresh flow, which is cheap; a state that survives a failure is a
    # replay window, which is not.
    supabase.table("business_google_oauth_states").update({"used_at": _now_iso()}).eq(
        "state", data.state
    ).execute()

    body = _post_token(
        {
            "client_id": client_id,
            "code": data.code,
            "code_verifier": state_row["code_verifier"],
            "redirect_uri": state_row["redirect_uri"],
            "grant_type": "authorization_code",
        },
        "code exchange",
    )

    access_token = body.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=400, detail="Google didn't return a usable connection"
        )

    granted = str(body.get("scope") or "")
    if GBP_SCOPE not in granted:
        # The user un-ticked the permission on the consent screen. Say exactly
        # that instead of letting the first API call fail with a 403.
        raise HTTPException(
            status_code=400,
            detail=(
                "SwingBy needs permission to read your Business Profile "
                "reviews. Try again and leave that box ticked."
            ),
        )

    expiry = _now() + timedelta(seconds=int(body.get("expires_in") or 3600))
    email = _google_account_email(body)

    row = {
        "business_id": business["id"],
        "connected_by": current_user["id"],
        "google_account_email": email,
        "access_token": access_token,
        "token_expires_at": expiry.isoformat(),
        "scopes": granted,
        "status": "connected",
        "last_import_error": None,
        "updated_at": _now_iso(),
    }
    # Google only issues a refresh token on the first grant for a given client
    # + user unless prompt=consent forces one. Never overwrite a good stored
    # refresh token with the absence of one.
    if body.get("refresh_token"):
        row["refresh_token"] = body["refresh_token"]

    supabase.table("business_google_connections").upsert(
        row, on_conflict="business_id"
    ).execute()

    return {
        "connected": True,
        "google_account_email": email,
        "locations": _list_locations(access_token),
    }


def _google_account_email(token_body: dict) -> Optional[str]:
    """Best-effort account email out of the id_token, without verifying it.

    This is display-only ("Connected as ada@…"), never an authorisation input,
    so an unverified read of the JWT payload is adequate and avoids pulling in
    a JWKS round trip. Anything unexpected yields None and the UI just omits it.
    """
    raw = token_body.get("id_token")
    if not raw or not isinstance(raw, str) or raw.count(".") != 2:
        return None
    try:
        payload_b64 = raw.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        email = payload.get("email")
        return str(email)[:255] if email else None
    except Exception:
        return None


@router.get("/locations")
def list_google_locations(current_user: dict = Depends(get_current_user)):
    """The connected account's Business Profile locations, for the picker."""
    _require_enabled()
    business = _owner_business(current_user)
    conn = _require_connection(business["id"])
    access_token = _ensure_access_token(conn)
    return {
        "locations": _list_locations(access_token),
        "selected_location": conn.get("selected_location"),
    }


@router.post("/import")
def import_google_reviews(
    data: ImportRequest, current_user: dict = Depends(get_current_user)
):
    """Import every review Google holds for the chosen location. Idempotent."""
    _require_enabled()
    business = _owner_business(current_user)
    conn = _require_connection(business["id"])
    access_token = _ensure_access_token(conn)

    # The location must belong to the CONNECTED account. Without this an owner
    # could post any location resource name and import a competitor's reviews
    # onto their own profile — the tokens would happily be accepted by Google
    # for any location that account can see, and this check is what makes
    # "your own reviews" true rather than merely intended.
    locations = _list_locations(access_token)
    chosen = next((loc for loc in locations if loc["name"] == data.location), None)
    if chosen is None:
        raise HTTPException(
            status_code=403,
            detail="That location isn't on the Google account you connected",
        )

    try:
        result = _import_reviews_for_location(
            business["id"], data.location, current_user["id"], access_token
        )
    except HTTPException as exc:
        _save_connection(business["id"], {"last_import_error": str(exc.detail)[:500]})
        raise

    _save_connection(
        business["id"],
        {
            "selected_location": data.location,
            "selected_location_title": chosen.get("title"),
            "last_import_at": _now_iso(),
            "last_import_error": None,
        },
    )

    rows = _imported_reviews(business["id"])
    return {**result, "reviews": rows, "summary": _summarise(rows)}


@router.delete("/disconnect")
def disconnect_google(current_user: dict = Depends(get_current_user)):
    """Revoke at Google, forget the tokens, and remove the imported reviews.

    The imported reviews go too, on purpose. Their entire claim is "this
    business proved it owns the Google profile these came from". Once that
    proof is withdrawn, continuing to show them would be showing an unbacked
    claim — so disconnecting is also the delete switch, and the UI says so
    before it fires.
    """
    business = _owner_business(current_user)
    conn = _load_connection(business["id"])

    if conn and conn.get("refresh_token"):
        try:
            httpx.post(
                GOOGLE_REVOKE_URL,
                data={"token": conn["refresh_token"]},
                timeout=HTTP_TIMEOUT_SECONDS,
            )
        except Exception:
            # Best effort. Google being unreachable must not trap a user in a
            # connection they asked to end — we still drop our copy below.
            logger.warning(
                "Could not revoke Google token for business %s", business["id"]
            )

    supabase.table("business_imported_reviews").delete().eq(
        "business_id", business["id"]
    ).execute()
    supabase.table("business_google_connections").delete().eq(
        "business_id", business["id"]
    ).execute()

    return {"connected": False, "removed_reviews": True}


@router.get("/business/{business_id}")
def get_imported_reviews(
    business_id: str, current_user: dict = Depends(get_current_user)
):
    """Client-facing read: a business's imported reviews, labelled as imported.

    Ungated by the feature flag. When the flag has never been on there are no
    rows and this returns an empty list, which is exactly what the profile
    screen needs; and if the flag is ever switched back off, reviews an owner
    legitimately imported do not blink out of existence.

    Every row carries `source` and `verified` so the caller cannot render one
    of these as if it were a native SwingBy review by accident.
    """
    rows = _imported_reviews(business_id)
    return {"reviews": rows, "summary": _summarise(rows), "source": "google"}
