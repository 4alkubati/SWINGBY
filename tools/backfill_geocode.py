#!/usr/bin/env python3
"""
backfill_geocode.py — Resolve coordinates for service posts that never got them.

Every job posted before 2026-07-19 has NULL lat/lng, because the mobile Places
autocomplete was gated on an env var that was never set. Those posts are
invisible to anything map- or distance-based. This walks them and fills in
coordinates from their stored address via the Google Geocoding API.

Safe to re-run. Rows that resolve are marked 'geocoding_api'; rows whose
address Google cannot resolve are marked 'failed' and skipped on later runs
unless --retry-failed is passed, so a handful of bad addresses never turn into
a recurring quota bill.

PREREQUISITE: docs/geocoding_columns.sql must be applied first — this writes
`geocode_source` and `geocoded_at`. It checks for them and exits cleanly if
they are missing rather than half-writing.

Usage (from repo root, with backend/.env loaded):
    python tools/backfill_geocode.py --dry-run     # show what would change
    python tools/backfill_geocode.py               # do it
    python tools/backfill_geocode.py --retry-failed
    python tools/backfill_geocode.py --limit 10    # cap API calls
"""

import argparse
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.services.geocoding import geocode_address  # noqa: E402
from app.supabase_client import supabase  # noqa: E402

# Google's published limit is 50 requests/second; this is far below it. The
# pause exists to be a polite client, not to dodge a limit we would ever reach
# at this table size.
_PAUSE_SECONDS = 0.12


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _columns_exist() -> bool:
    """Verify the provenance migration has been applied before writing."""
    try:
        supabase.table("service_posts").select("geocode_source").limit(1).execute()
        return True
    except Exception:
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="also retry rows previously marked 'failed'",
    )
    parser.add_argument("--limit", type=int, default=0, help="max rows to process (0 = all)")
    args = parser.parse_args()

    if not _columns_exist():
        print(
            "ERROR: service_posts.geocode_source is missing.\n"
            "       Apply docs/geocoding_columns.sql first, then re-run.",
            file=sys.stderr,
        )
        return 2

    query = (
        supabase.table("service_posts")
        .select("id, address, lat, lng, geocode_source")
        .is_("lat", "null")
        .not_.is_("address", "null")
    )
    rows = query.execute().data or []

    if not args.retry_failed:
        rows = [r for r in rows if r.get("geocode_source") != "failed"]
    if args.limit:
        rows = rows[: args.limit]

    if not rows:
        print("Nothing to do — every post with an address already has coordinates.")
        return 0

    print(f"{len(rows)} post(s) to geocode{' (dry run)' if args.dry_run else ''}.\n")

    resolved = failed = 0
    for row in rows:
        address = (row.get("address") or "").strip()
        post_id = row["id"]

        coords = geocode_address(address)
        if coords is None:
            failed += 1
            print(f"  FAIL  {post_id}  {address!r}")
            if not args.dry_run:
                supabase.table("service_posts").update(
                    {"geocode_source": "failed", "geocoded_at": _now_iso()}
                ).eq("id", post_id).execute()
        else:
            lat, lng = coords
            resolved += 1
            print(f"  OK    {post_id}  {address!r} -> {lat:.6f},{lng:.6f}")
            if not args.dry_run:
                supabase.table("service_posts").update(
                    {
                        "lat": lat,
                        "lng": lng,
                        "geocode_source": "geocoding_api",
                        "geocoded_at": _now_iso(),
                    }
                ).eq("id", post_id).execute()

        time.sleep(_PAUSE_SECONDS)

    verb = "would be" if args.dry_run else "were"
    print(f"\n{resolved} {verb} resolved, {failed} unresolvable.")
    if failed:
        print("Unresolvable rows are marked 'failed' and skipped next run "
              "(override with --retry-failed).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
