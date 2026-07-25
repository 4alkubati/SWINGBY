"""
privacy.py — pre-acceptance client PII masking.

THE RULE (product-owner ruling, walkthrough audit 2026-07-24, items L1/L2/L3
and S1 — supersedes the original CARD-23 spec):

    Until the client has ACCEPTED a quote (i.e. a booking exists between the
    two parties), a business sees **nothing identifying about that client**.

Concretely, a pre-acceptance job post renders as:

    "Client" · locality only · category · title · description ·
    preferred date · "3 photos"

and nothing else. In particular a business does NOT get, before acceptance:

    * the client's first name          (was returned until 2026-07-24)
    * the client's last name
    * the client's avatar              (was returned until 2026-07-24)
    * the client's user id / client_id (made the profile tappable — L2)
    * the exact street address         (locality only, and fail-closed — L4)
    * exact lat/lng                    (coarsened to a ~1 km grid)
    * the job photos themselves        (count only — L3)
    * the client's budget              (ruling S1 — businesses bid their own
                                        rate, the client compares)

Everything unlocks on acceptance, for the WINNING business only, through the
booking read path (``backend/app/api/bookings.py``), which joins the client
user row and the post address in full and is gated by
``_assert_booking_access``. That path is deliberately untouched by this module.

WHY THE PHOTOS ARE COUNT-ONLY RATHER THAN WITHHELD ENTIRELY
    Job photos are the worst item in the audit: they are photographs of the
    inside of someone's home, and today any account that signs up as a
    business can page the open feed and harvest them against a first name and
    a neighbourhood. Two options were on the table:

      (a) withhold entirely — a business quoting blind on "clean my garage"
          cannot price the job, so it quotes high or not at all; the
          marketplace stops working.
      (b) return the COUNT only ("3 photos"), and unlock the images on
          acceptance.

    (b) is the least-bad: the business learns that visual detail exists and
    can quote conditionally, the client keeps control, and a fake business
    account harvests nothing but an integer. This is the shipped behaviour —
    ``image_urls`` is emptied and ``photo_count`` is added.

WHY ONE MODULE
    So the rule can't drift between endpoints. Every read path that returns
    service_posts / users data BEFORE acceptance funnels through
    :func:`mask_service_post_row`: the feed, single-post GET, a business's own
    sent-quotes list, and the quote-thread inbox. The original bug was
    ``select("*")`` leaking by default; one shared masking function is the fix
    that does not regress silently when a new column is added.
"""

from typing import Optional

# What a business sees where a client's name would otherwise be. Never a real
# name, never derived from one.
MASKED_CLIENT_LABEL = "Client"

# Decimal places kept on pre-acceptance coordinates. 2 dp ≈ a 1.1 km grid cell
# in latitude — enough for "how far away is this job", useless for "which
# house". Exact coordinates are the street address by another name, and they
# are also what would let a business trilaterate a masked client's home by
# watching the distance figure move (audit L7).
_COARSE_COORD_DP = 2


def mask_address_to_locality(address: Optional[str]) -> Optional[str]:
    """
    Truncate a full street address down to its locality portion — FAIL CLOSED.

    Expected shape: ``"123 Main St NW, Calgary, AB T2N 1N4"`` — street
    number/name, then comma-separated city/province/postal. Returns everything
    after the FIRST comma, which drops the street-identifying part while
    keeping enough for a business to judge distance.

    **No comma → None.** (Audit L4.) The previous implementation passed a
    comma-less value straight through whenever it did not start with a digit,
    on the theory that such a string is already locality-only ("Calgary").
    Google autocomplete always supplies the comma; free-typed text does not, so
    a client who typed ``"Citadel Meadow Gardens NW"`` had their exact address
    published verbatim to every business in the city. There is no way to tell
    that string from a bare city name by shape alone, so the ambiguous case now
    resolves to "show nothing" instead of "show everything". A client who wants
    their neighbourhood shown gets it by picking a structured place (which
    carries the comma).
    """
    if not address:
        return None
    parts = address.split(",", 1)
    if len(parts) == 2:
        locality = parts[1].strip()
        return locality or None
    # Ambiguous single-segment string: could be a bare city, could be a
    # comma-less street address. Fail closed.
    return None


def coarsen_coordinate(value) -> Optional[float]:
    """Round one coordinate to the pre-acceptance grid, or None if unusable."""
    if value is None:
        return None
    try:
        return round(float(value), _COARSE_COORD_DP)
    except (TypeError, ValueError):
        return None


def mask_user_public(user: Optional[dict]) -> Optional[dict]:
    """
    Replace a client's public profile with the anonymous placeholder.

    Returns the SAME KEYS every caller already reads (``first_name``,
    ``last_name``, ``avatar_url``) so no consumer has to special-case a missing
    object — they are simply all ``None`` — plus ``display_name`` for surfaces
    that want a label to render. ``None`` in, ``None`` out.
    """
    if user is None:
        return None
    return {
        "display_name": MASKED_CLIENT_LABEL,
        "first_name": None,
        "last_name": None,
        "avatar_url": None,
    }


def mask_service_post_row(post: dict) -> dict:
    """
    Apply pre-acceptance masking to one ``service_posts`` row.

    Returns a NEW dict — never mutates the input. Only keys that are present
    are touched, so this is safe on both a ``select("*")`` row and a narrow
    projection (e.g. the ``service_posts(id, title, status)`` embed in the
    messages inbox).

    Applied:
      address       → locality only, fail-closed (:func:`mask_address_to_locality`)
      lat / lng     → coarsened to a ~1 km grid
      users         → anonymous placeholder, always present
                      (:func:`mask_user_public`)
      client_id     → removed (L2: this is what made the client profile tappable)
      budget        → removed (ruling S1: businesses bid their own rate)
      image_urls    → emptied, replaced by ``photo_count`` (L3)
    """
    if not post:
        return post
    masked = dict(post)

    if "address" in masked:
        masked["address"] = mask_address_to_locality(masked.get("address"))
    if "lat" in masked:
        masked["lat"] = coarsen_coordinate(masked.get("lat"))
    if "lng" in masked:
        masked["lng"] = coarsen_coordinate(masked.get("lng"))
    # Always emitted, present in the source row or not, so every pre-acceptance
    # surface renders the identical anonymous counterpart instead of one screen
    # showing "Client" and another showing a blank. The value is a constant —
    # it cannot leak anything.
    masked["users"] = mask_user_public(masked.get("users") or {})

    # Identity handles. client_id is a direct route to GET /users/{id} and to
    # the client profile screen; user_id is the same thing under the name some
    # embeds use.
    masked.pop("client_id", None)
    masked.pop("user_id", None)

    # Ruling S1 — the budget is the client's private ceiling. A business that
    # can see it bids to it.
    masked.pop("budget", None)
    masked.pop("budget_min", None)
    masked.pop("budget_max", None)

    # L3 — photos are the payload. Count only, until acceptance.
    if "image_urls" in masked:
        urls = masked.get("image_urls") or []
        masked["photo_count"] = len(urls) if isinstance(urls, (list, tuple)) else 0
        masked["image_urls"] = []

    return masked
