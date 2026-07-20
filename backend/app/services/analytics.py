"""
analytics.py — minimal funnel events to Plausible (audit fault K7 — no-analytics).

Plausible is the platform's analytics layer: client-side + keyless, wired
into the web launch site via VITE_PLAUSIBLE_DOMAIN=swingbyy.com (frontend's
domain — see docs/DEPLOY.md). The actual product — signup, booking,
completion — happens in the mobile app (Expo/React Native), which has no
DOM, so Plausible's JS snippet cannot fire there at all. Server-side calls
to Plausible's Events API from the backend routes that already see those
moments are the only way to get this funnel out of the real product rather
than just the marketing site. This module is deliberately backend-only and
does not touch, replace, or duplicate the frontend's client-side wiring.

Non-blocking by construction: every call is wrapped in try/except with a
short timeout and NEVER raises — an analytics outage must not fail a
signup, a booking, or a payment. Mirrors the existing "best-effort, never
blocks" pattern already used for Notion CRM sync and welcome emails in
app/api/auth.py.

Plausible's Events API needs no API key ("keyless") — only a domain match
and a User-Agent header (requests without one are dropped as bot traffic).
Verified live 2026-07-19: a test POST to this endpoint returned HTTP 202.

Known limitation (documented, not hidden): Plausible's visitor-uniqueness
model is built for browser sessions (cookies/fingerprint from a real
pageview). A server-side event carries no such session, so each call shows
as its own visit in the Plausible dashboard — this tracks EVENT OCCURRENCES
(a signup happened, a booking was created, a booking completed), not a
per-user funnel conversion rate. That's consistent with "wire the smallest
useful funnel" — for true per-user conversion tracking later, a dedicated
events table + admin-dashboard aggregation would be the correct next step,
not more Plausible calls.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

PLAUSIBLE_EVENT_URL = "https://plausible.io/api/event"
PLAUSIBLE_DOMAIN = "swingbyy.com"
_TIMEOUT_SECONDS = 3.0
_USER_AGENT = "SwingBy-Backend/1.0 (+https://swingbyy.com)"


def track_event(
    event_name: str,
    *,
    url_path: str = "/",
    props: Optional[dict] = None,
) -> None:
    """
    Fire-and-forget a custom event to Plausible.

    Never raises — callers should NOT wrap this in their own try/except; it
    already swallows everything so a Plausible outage can't take down a
    request path. Call it AFTER the state-changing work has already
    succeeded (mirrors where the welcome-email / CRM-sync calls sit in
    auth.py), never before or in place of it.

    `url_path` is synthesized — the mobile app has no real URL — as
    app://<domain><path> so these events are visibly distinguishable in the
    Plausible dashboard from real web pageviews on the same domain.
    """
    try:
        payload: dict = {
            "domain": PLAUSIBLE_DOMAIN,
            "name": event_name,
            "url": f"app://{PLAUSIBLE_DOMAIN}{url_path}",
        }
        if props:
            payload["props"] = props
        httpx.post(
            PLAUSIBLE_EVENT_URL,
            json=payload,
            headers={"User-Agent": _USER_AGENT, "Content-Type": "application/json"},
            timeout=_TIMEOUT_SECONDS,
        )
    except Exception:
        logger.warning("plausible_track_event_failed", exc_info=True)
