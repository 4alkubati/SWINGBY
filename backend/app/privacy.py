"""
privacy.py — pre-acceptance client PII masking (CARD-23).

THE RULE (matches the published privacy policy and the "INTERESTS as spam
shield" design decision in CLAUDE.md): before a client accepts an interest,
a business browsing/quoting sees only what it needs to quote — category,
budget, description, photos, approximate location, and the client's FIRST
name. Full legal name and exact street address unlock only once the client
accepts (a booking exists). The booking read path (backend/app/api/
bookings.py) already enforces this correctly and is untouched by this
module — this module is for every read path that returns service_posts /
users data BEFORE that point: the feed, single-post GET, a business's own
sent-quotes list, and quote-thread messaging.

Single place so the masking rule can't drift between endpoints — the
original bug was `select("*")` leaking-by-default; an explicit allow-list
plus one shared masking function is the fix that doesn't regress silently
when a new column is added.
"""

from typing import Optional


def mask_address_to_locality(address: Optional[str]) -> Optional[str]:
    """
    Truncate a full street address down to its locality portion.

    Expected shape: "123 Main St NW, Calgary, AB T2N 1N4" — street number/
    name, then comma-separated city/province/postal. Returns everything
    after the first comma, stripped, which drops the street-identifying
    part while keeping enough for a business to judge distance.

    If there's no comma, the string doesn't look like street+locality; a
    value starting with a digit is almost certainly a bare street address,
    so it's hidden entirely rather than guessed at. A value that doesn't
    start with a digit (e.g. just "Calgary") is passed through — it's
    already locality-only.
    """
    if not address:
        return None
    parts = address.split(",", 1)
    if len(parts) == 2:
        locality = parts[1].strip()
        return locality or None
    stripped = address.strip()
    if stripped[:1].isdigit():
        return None
    return stripped or None


def mask_user_public(user: Optional[dict]) -> Optional[dict]:
    """First name + avatar only — strips last_name and anything else."""
    if not user:
        return user
    return {
        "first_name": user.get("first_name"),
        "avatar_url": user.get("avatar_url"),
    }


def mask_service_post_row(post: dict) -> dict:
    """
    Apply pre-acceptance masking to one service_posts row (optionally with
    a nested `users` join from `users(first_name, last_name, avatar_url)`).
    Returns a new dict — does not mutate the input.
    """
    if not post:
        return post
    masked = dict(post)
    if "address" in masked:
        masked["address"] = mask_address_to_locality(masked.get("address"))
    if "users" in masked:
        masked["users"] = mask_user_public(masked.get("users"))
    return masked
