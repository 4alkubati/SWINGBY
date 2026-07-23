"""
geocoding.py — Address → coordinates via the Google Geocoding API.

Why this exists: `lat`/`lng` have always been on `service_posts` and
`businesses`, and the backend has always read and written them. But the only
writer was a mobile Google Places branch gated on an env var that was never
set, so in practice every self-serve row has NULL coordinates. That silently
breaks geo-browse — `GET /businesses/nearby` skips rows without coords
(businesses.py), so only the seeded businesses ever appear on the map.

This module is the server-side fallback: when a client posts an address but no
coordinates, resolve them here instead of trusting the app to have done it.

Best-effort, exactly like notion_crm.py: never raises, never blocks the write
it supports. A post with an unresolvable address is still a valid post — it
just won't appear on the map until someone fixes the address.
"""

from typing import Optional, Tuple

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

_GEOCODE_API = "https://maps.googleapis.com/maps/api/geocode/json"
_TIMEOUT_SECONDS = 6.0

# Bias results toward the launch market. Google treats this as a hint, not a
# filter, so an out-of-region address still resolves — it just loses ties.
_REGION = "ca"

# Source markers written to `geocode_source`. Mirrors the CHECK constraint in
# docs/geocoding_columns.sql — keep the two in sync.
SOURCE_API = "geocoding_api"
SOURCE_FAILED = "failed"


def geocode_address(address: Optional[str]) -> Optional[Tuple[float, float]]:
    """
    Resolve a free-text address to (lat, lng).

    Returns None when the address is empty, no API key is configured, the
    request fails, or Google can't resolve it. Callers treat None as "leave the
    coordinates NULL" — never as an error worth failing the request over.
    """
    if not address or not address.strip():
        return None

    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        # Not an error worth shouting about: local dev and CI run without a
        # key, and the mobile Places branch may have supplied coords already.
        logger.debug("geocode_skipped_no_key")
        return None

    try:
        resp = httpx.get(
            _GEOCODE_API,
            params={"address": address.strip(), "key": api_key, "region": _REGION},
            timeout=_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception:
        # Network, timeout, non-2xx, or unparseable body. Address is logged —
        # it is user-entered location data, not a credential.
        logger.warning("geocode_request_failed", address=address, exc_info=True)
        return None

    status = payload.get("status")
    if status != "OK":
        # ZERO_RESULTS is an ordinary outcome for a typo'd address.
        # REQUEST_DENIED / OVER_QUERY_LIMIT mean the key is misconfigured or
        # capped, which is an operator problem — log loudly enough to notice.
        level = logger.info if status == "ZERO_RESULTS" else logger.warning
        level("geocode_no_result", status=status, address=address)
        return None

    try:
        location = payload["results"][0]["geometry"]["location"]
        lat = float(location["lat"])
        lng = float(location["lng"])
    except (KeyError, IndexError, TypeError, ValueError):
        logger.warning("geocode_bad_payload", address=address)
        return None

    if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        logger.warning("geocode_out_of_range", lat=lat, lng=lng, address=address)
        return None

    logger.info("geocode_ok", address=address, lat=lat, lng=lng)
    return lat, lng


def resolve_coordinates(
    lat: Optional[float],
    lng: Optional[float],
    address: Optional[str],
) -> dict:
    """
    Build the coordinate fields for an insert/update payload.

    Returns ONLY `lat`/`lng`.

    `geocode_source`/`geocoded_at` DO exist in prod as of the
    docs/geocoding_columns.sql apply (verified 2026-07-21), but this function
    still does not write them: provenance is owned by tools/backfill_geocode.py,
    which is the single writer. If the request path should start stamping
    provenance, that is a deliberate change — add both columns to the payload
    here and to the backfill's conflict handling together.

    If the caller already supplied both coordinates (the mobile Places
    autocomplete path), they win untouched — the app's own resolution is more
    precise than re-geocoding a formatted string, and it costs nothing.
    """
    if lat is not None and lng is not None:
        return {"lat": lat, "lng": lng}

    if not address or not address.strip():
        return {"lat": lat, "lng": lng}

    coords = geocode_address(address)
    if coords is None:
        return {"lat": lat, "lng": lng}

    resolved_lat, resolved_lng = coords
    return {"lat": resolved_lat, "lng": resolved_lng}
