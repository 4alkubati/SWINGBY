"""
categories.py — canonical service/business category labels + relatedness map.

Canonical rule: `id = label.lower()`; the DB stores the capitalized label.
Callers use `.ilike` in queries so legacy lowercase rows (e.g. rows created by
the e2e smoke test as `'cleaning'`) still match. ZERO migration required.
"""

CANONICAL_CATEGORIES = [
    "Cleaning",
    "Plumbing",
    "Electrical",
    "Landscaping",
    "Painting",
    "Carpentry",
    "Moving",
    "Handyman",
]

GENERAL = "General"

_CANONICAL_BY_LOWER = {c.lower(): c for c in CANONICAL_CATEGORIES}


def normalize_category(v: str) -> str:
    """
    Case-insensitive snap to a canonical label.

    Strips whitespace, then matches against CANONICAL_CATEGORIES on `.lower()`.
    Unknown values pass through stripped (original casing preserved) so we
    never destroy data we don't recognize. None/empty input returns "".
    """
    if v is None:
        return ""
    stripped = str(v).strip()
    if not stripped:
        return ""
    return _CANONICAL_BY_LOWER.get(stripped.lower(), stripped)


def resolve_create_category(v: str) -> str:
    """
    Category resolution for POST /service-posts/ (create) only.

    Snaps to a canonical trade label on match (via normalize_category);
    anything unmatched — including off-taxonomy values like "Reiki" or an
    explicit case-variant of "general" — snaps to GENERAL ("General")
    instead of being stored verbatim. This is the Amr decision from the
    2026-07-16 QA audit: keep the trades taxonomy tight, catch everything
    else in one searchable bucket.

    Deliberately NOT folded into normalize_category() itself: that function
    also backs the `?category=` search/auto-filter path (list_open_posts /
    allowed_categories_for), which must keep accepting arbitrary search
    strings unchanged — snapping there would silently rewrite what a caller
    searched for. Only the create path snaps.
    """
    norm = normalize_category(v)
    if norm in CANONICAL_CATEGORIES:
        return norm
    return GENERAL


# Conservative, symmetric relatedness pairs. Listed once per pair; the loop
# below mirrors each pair into both directions so RELATED is guaranteed
# symmetric by construction (not by hand-maintained duplication).
#
# Cleaning, Landscaping, and Moving are intentionally left UNLINKED — distinct
# trades with negligible overlap with anything else in the list.
_RELATED_PAIRS = [
    ("Handyman", "Carpentry"),
    ("Handyman", "Painting"),
    ("Handyman", "Plumbing"),
    ("Handyman", "Electrical"),
    ("Carpentry", "Painting"),
]

RELATED: dict[str, list[str]] = {c: [] for c in CANONICAL_CATEGORIES}
for _a, _b in _RELATED_PAIRS:
    RELATED[_a].append(_b)
    RELATED[_b].append(_a)

# Symmetry guarantee — fails loudly at import time if _RELATED_PAIRS is ever
# edited into an asymmetric state.
for _cat, _related in RELATED.items():
    for _other in _related:
        assert (
            _cat in RELATED[_other]
        ), f"RELATED is not symmetric for {_cat} <-> {_other}"


def allowed_categories_for(cat: str) -> list[str]:
    """
    Categories a business of type `cat` should see posts for: itself, its
    related categories, and General — de-duplicated, own-first-then-related-
    then-General order preserved.
    """
    norm = normalize_category(cat)
    ordered = [norm] + RELATED.get(norm, []) + [GENERAL]
    seen = set()
    result = []
    for c in ordered:
        if c and c not in seen:
            seen.add(c)
            result.append(c)
    return result
