"""
test_bookings_select_columns.py — Regression guard for the
`column bookings_1.scheduled_date does not exist` production crash
(Sentry, 2026-07-20).

Root cause: payments.py, disputes.py, and invoices.py selected
`bookings.scheduled_date` in three PostgREST `.select(...)` strings (five
call sites total), but that column was never written anywhere and does not
exist on the live `bookings` table (see docs/swingby_database_schema.md §6 —
`scheduled_date` is documented as "referenced in select() calls, never
written anywhere found"). The fix replaced every `scheduled_date` reference
with `confirmed_date` (the column the booking-confirm handshake and
interest-accept flow actually write) or dropped it where already redundant.

This test prevents the same class of bug from recurring silently: it scans
every `backend/app/api/*.py` source file for PostgREST `.select(...)`
strings that reference `bookings` columns — either directly (`.table(
"bookings").select("...")`) or via a nested join (`"*, bookings(...)"`) —
and asserts every referenced column name is in a hand-maintained allowlist
derived from docs/swingby_database_schema.md §6. If a future change
introduces a reference to a column that isn't in the schema doc (a typo, a
renamed column, or another `scheduled_date`-style ghost column), this test
fails at CI time instead of at request time in production.

Maintenance: when the schema doc's bookings table gains/loses a column,
update ALLOWED_BOOKINGS_COLUMNS to match.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

API_DIR = Path(__file__).parent.parent / "app" / "api"

# Derived from docs/swingby_database_schema.md, section 6 "`bookings`".
# NOTE: `scheduled_date` is intentionally NOT in this set — it is documented
# there as a column that is read in selects but never written, and does not
# exist on the live table (the bug this test guards against).
ALLOWED_BOOKINGS_COLUMNS = {
    "id",
    "client_id",
    "business_id",
    "employee_id",
    "post_id",
    "service_category",
    "total_amount",
    "commission_rate",
    "platform_fee",
    "status",
    "payment_status",
    "proposed_date_1",
    "proposed_date_2",
    "proposed_date_3",
    "date_proposed_by",
    "confirmed_date",
    "completed_at",
    "created_at",
}

# Known-bad columns we've been bitten by before — kept explicit so the
# failure message is legible even if ALLOWED_BOOKINGS_COLUMNS ever drifts.
KNOWN_GHOST_COLUMNS = {"scheduled_date"}


def _extract_select_call_spans(text: str) -> list[str]:
    """Return the raw source text inside every `.select(...)` call in `text`,
    matching parens by depth so nested PostgREST join syntax like
    `bookings(col1, col2)` doesn't truncate the span early."""
    spans = []
    for m in re.finditer(r"\.select\(", text):
        start = m.end()
        depth = 1
        i = start
        while depth > 0 and i < len(text):
            if text[i] == "(":
                depth += 1
            elif text[i] == ")":
                depth -= 1
            i += 1
        spans.append((m.start(), text[start : i - 1]))
    return spans


def _leading_select_string(raw_span: str) -> str:
    """Reconstruct the actual PostgREST select string from the Python source
    span, handling implicit adjacent-string-literal concatenation, and
    stopping before any trailing kwarg argument (e.g. `count="exact"`) that
    isn't part of the select-columns string itself."""
    m = re.match(r'^\s*((?:["\'][^"\']*["\']\s*)+)', raw_span)
    if not m:
        return ""
    parts = re.findall(r'["\']([^"\']*)["\']', m.group(1))
    return "".join(parts)


def _split_top_level(select_str: str) -> list[str]:
    """Split a PostgREST select string on top-level commas only (not commas
    inside a nested join's parens)."""
    tokens = []
    depth = 0
    current = []
    for ch in select_str:
        if ch == "(":
            depth += 1
            current.append(ch)
        elif ch == ")":
            depth -= 1
            current.append(ch)
        elif ch == "," and depth == 0:
            tokens.append("".join(current))
            current = []
        else:
            current.append(ch)
    if current:
        tokens.append("".join(current))
    return [t.strip() for t in tokens if t.strip()]


def _nearest_preceding_table(text: str, pos: int) -> str | None:
    """Find the table name of the nearest `.table("<name>")` call before
    `pos` in the same statement (searched within a small preceding window —
    these chains are never more than a few hundred characters long in this
    codebase)."""
    window = text[max(0, pos - 400) : pos]
    matches = list(re.finditer(r'\.table\(\s*["\'](\w+)["\']\s*\)', window))
    if not matches:
        return None
    return matches[-1].group(1)


def _iter_bookings_column_references():
    """Yield (file, context, column) for every column name this codebase's
    `.select(...)` calls reference against the `bookings` table — whether
    selected directly off `supabase.table("bookings")` or via a nested
    `bookings(...)` join from another table's select."""
    for path in sorted(API_DIR.glob("*.py")):
        text = path.read_text()
        for pos, raw_span in _extract_select_call_spans(text):
            select_str = _leading_select_string(raw_span)
            if not select_str:
                continue

            # (A) Nested join syntax: "...  bookings(col1, col2, ...)  ..."
            for jm in re.finditer(r"bookings\(([^)]*)\)", select_str):
                for col in jm.group(1).split(","):
                    col = col.strip()
                    if col:
                        yield (path.name, "nested bookings(...) join", col)

            # (B) Direct select off the bookings table itself.
            root_table = _nearest_preceding_table(text, pos)
            if root_table == "bookings":
                for token in _split_top_level(select_str):
                    if token == "*" or "(" in token:
                        # wildcard, or a nested join to some OTHER table
                        # (e.g. businesses(...) off of bookings) — out of
                        # scope for this check.
                        continue
                    # Strip PostgREST aliasing/fkey-hint syntax, e.g.
                    # "alias:column" or "column!fkey_name".
                    col = token.split(":")[-1].split("!")[0].strip()
                    if col:
                        yield (path.name, "direct bookings select", col)


class TestBookingsSelectColumnAllowlist:
    def test_all_referenced_columns_are_documented(self):
        """Every `bookings` column referenced by a `.select(...)` call
        anywhere in backend/app/api must exist in ALLOWED_BOOKINGS_COLUMNS
        (derived from docs/swingby_database_schema.md §6)."""
        violations = [
            (f, ctx, col)
            for (f, ctx, col) in _iter_bookings_column_references()
            if col not in ALLOWED_BOOKINGS_COLUMNS
        ]
        assert not violations, (
            "Found bookings column(s) referenced in a .select() that are not "
            "in the documented schema (docs/swingby_database_schema.md §6). "
            "This is exactly the bug class behind the "
            "'column bookings_1.scheduled_date does not exist' production "
            f"crash. Violations: {violations}"
        )

    def test_no_known_ghost_columns_referenced(self):
        """Belt-and-suspenders: explicitly assert none of the previously
        confirmed-nonexistent columns (e.g. scheduled_date) show up in any
        bookings select, even if ALLOWED_BOOKINGS_COLUMNS drifts in the
        future."""
        violations = [
            (f, ctx, col)
            for (f, ctx, col) in _iter_bookings_column_references()
            if col in KNOWN_GHOST_COLUMNS
        ]
        assert not violations, (
            f"Found reference(s) to a known-nonexistent bookings column: "
            f"{violations}"
        )

    @pytest.mark.parametrize(
        "filename",
        ["payments.py", "disputes.py", "invoices.py"],
    )
    def test_regression_files_have_no_scheduled_date_string(self, filename):
        """Direct textual check on the three files implicated in the Sentry
        crash — cheapest possible tripwire, independent of the parsing
        logic above."""
        text = (API_DIR / filename).read_text()
        assert "scheduled_date" not in text, (
            f"{filename} still references the nonexistent bookings.scheduled_date "
            "column — this caused a live 500 (Sentry: 'column "
            "bookings_1.scheduled_date does not exist')."
        )

    def test_allowlist_has_no_overlap_with_ghost_columns(self):
        """Sanity check on the fixture data itself."""
        assert not (ALLOWED_BOOKINGS_COLUMNS & KNOWN_GHOST_COLUMNS)
