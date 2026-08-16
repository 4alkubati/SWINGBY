"""
analytics.py — minimal funnel events to PostHog (audit fault K7 — no-analytics).

MIGRATED FROM PLAUSIBLE 2026-08-15. The public contract is unchanged:
``track_event(name, url_path=..., props=...)``, fire-and-forget, never raises.
No call site needed editing.

Why the swap. Plausible answers "how many", and the product questions before
the October launch are all "how many of the same people" — how many who signed
up posted a job, how many of those got a quote. Plausible could not answer
those from here *in principle*, and this module said so: its own docstring
recorded that a server-side event carries no browser session, so every call
landed as a separate visit and the funnel was event counts rather than per-user
conversion.

PostHog fixes precisely that, because identity is a field rather than an
inferred session: pass ``distinct_id`` and the event joins that person's other
events, web included. That is why the parameter exists below, and why wiring it
at the four call sites (auth, bookings, interests) is the one follow-up worth
doing — until then events carry a synthetic per-event id and this still only
counts occurrences.

Where the client-side half lives: ``web/*/src/lib/analytics.js``, gated on
``VITE_POSTHOG_KEY``. This module is backend-only and does not duplicate it.

Non-blocking by construction: every call is wrapped in try/except with a short
timeout and NEVER raises — an analytics outage must not fail a signup, a
booking, or a payment. Mirrors the "best-effort, never blocks" pattern already
used for Notion CRM sync and welcome emails in app/api/auth.py.

The key here is the PROJECT key (``phc_...``), the same public write-only value
the website bundle carries — not a personal API key. It can only append events.
"""

from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Ingest host, not the dashboard host: events go to <region>.i.posthog.com and
# queries go to <region>.posthog.com. Swapping them yields a 404 that reads
# like a credentials problem.
POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com").rstrip("/")
POSTHOG_CAPTURE_URL = f"{POSTHOG_HOST}/i/v0/e/"
POSTHOG_PROJECT_KEY = os.getenv("POSTHOG_PROJECT_KEY", "")

APP_DOMAIN = "swingbyy.com"
_TIMEOUT_SECONDS = 3.0
_USER_AGENT = "SwingByy-Backend/1.0 (+https://swingbyy.com)"


def track_event(
    event_name: str,
    *,
    url_path: str = "/",
    props: Optional[dict] = None,
    distinct_id: Optional[str] = None,
) -> None:
    """
    Fire-and-forget a custom event to PostHog.

    Never raises — callers should NOT wrap this in their own try/except; it
    already swallows everything so an analytics outage can't take down a
    request path. Call it AFTER the state-changing work has already succeeded
    (mirrors where the welcome-email / CRM-sync calls sit in auth.py), never
    before or in place of it.

    `distinct_id` is the user id when the caller has one. Pass it: it is what
    turns these from counts into a funnel, and it is the whole reason for the
    migration off Plausible. Omitted, a random id is generated so the event is
    still recorded — as its own anonymous person, which is exactly the
    limitation we moved to fix.

    `url_path` is synthesized — the mobile app has no real URL — as
    app://<domain><path>, so these stay visibly distinguishable from real web
    pageviews on the same domain.
    """
    if not POSTHOG_PROJECT_KEY:
        # Unset in local dev and CI. Silent by design: a warning per signup in
        # a test run is noise, and there is nothing an operator can do about it
        # from inside a request.
        return
    try:
        payload: dict = {
            "api_key": POSTHOG_PROJECT_KEY,
            "event": event_name,
            "distinct_id": distinct_id or f"anon-{uuid.uuid4()}",
            "properties": {
                **(props or {}),
                "$current_url": f"app://{APP_DOMAIN}{url_path}",
                "source": "backend",
            },
        }
        httpx.post(
            POSTHOG_CAPTURE_URL,
            json=payload,
            headers={"User-Agent": _USER_AGENT, "Content-Type": "application/json"},
            timeout=_TIMEOUT_SECONDS,
        )
    except Exception:
        logger.warning("posthog_track_event_failed", exc_info=True)
