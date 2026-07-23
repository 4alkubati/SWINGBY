"""
teardown_demo.py — remove exactly what seed_demo.py created. Nothing else.

Safety rules baked in:
  * it only ever deletes ids listed in backend/scripts/demo_seed_manifest.json
  * before deleting an account it re-reads that user's email from the database
    and refuses unless the email is on the demo.swingbyy.com domain
  * a row in the manifest that is no longer in the database is simply skipped
  * --dry-run shows exactly what would go, and deletes nothing

USAGE
    cd backend
    .venv/bin/python scripts/teardown_demo.py --dry-run
    .venv/bin/python scripts/teardown_demo.py --yes
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))
import demo_dataset as ds  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]
MANIFEST_PATH = Path(__file__).resolve().parent / "demo_seed_manifest.json"

load_dotenv(os.getenv("SWINGBY_ENV_FILE") or (BACKEND_DIR / ".env"))

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
# Legacy projects use SUPABASE_SERVICE_KEY (JWT service_role); newer ones use
# the SUPABASE_SECRET_KEY (sb_secret_…) API key. Either grants the writes
# this script needs — take whichever is populated.
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or ""
if not SUPABASE_URL or not SERVICE_KEY:
    sys.exit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env.")

REST = f"{SUPABASE_URL}/rest/v1"
AUTH = f"{SUPABASE_URL}/auth/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def log(msg: str) -> None:
    print(f"[teardown] {msg}", flush=True)


def admin_call(client: httpx.Client, method: str, url: str, **kw) -> httpx.Response:
    """
    GoTrue admin call, retried through this project's intermittent
    403 bad_jwt ("unrecognized JWT kid <nil> for algorithm ES256"). Roughly one
    call in four fails that way and succeeds on the next attempt — without the
    retry, teardown leaves orphaned rows in auth.users.
    """
    resp = None
    for attempt in range(6):
        resp = client.request(method, url, headers=HEADERS, **kw)
        if not (resp.status_code == 403 and "bad_jwt" in resp.text):
            return resp
        time.sleep(1.0 + attempt)
    return resp


def delete_ids(client: httpx.Client, table: str, ids: list[str], dry: bool) -> int:
    removed = 0
    for i in range(0, len(ids), 50):
        chunk = ids[i : i + 50]
        present = client.get(
            f"{REST}/{table}",
            params={"id": f"in.({','.join(chunk)})", "select": "id"},
            headers=HEADERS,
        )
        present.raise_for_status()
        found = [row["id"] for row in present.json()]
        if not found:
            continue
        if dry:
            removed += len(found)
            continue
        r = client.delete(
            f"{REST}/{table}",
            params={"id": f"in.({','.join(found)})"},
            headers={**HEADERS, "Prefer": "return=minimal"},
        )
        if r.status_code not in (200, 204):
            raise RuntimeError(f"{table} delete failed: {r.status_code} {r.text[:300]}")
        removed += len(found)
    return removed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--yes", action="store_true", help="actually delete")
    args = ap.parse_args()

    if not args.dry_run and not args.yes:
        sys.exit("Refusing to delete without --yes (or use --dry-run).")

    if not MANIFEST_PATH.exists():
        sys.exit(f"No manifest at {MANIFEST_PATH}. Nothing can be safely removed.")

    manifest = json.loads(MANIFEST_PATH.read_text())
    if manifest.get("seed_tag") != ds.SEED_TAG:
        sys.exit("Manifest seed_tag does not match this script. Aborting.")

    dry = args.dry_run
    with httpx.Client(timeout=60.0) as client:
        # 1. child rows first (bookings cascade would cover most of these, but
        #    being explicit means we never rely on cascade reaching a row we
        #    did not list).
        for table in ds.DELETE_ORDER:
            if table == "users":
                continue  # handled below, after the email check
            n = delete_ids(client, table, manifest["ids"][table], dry)
            log(f"{table:<15} {n} rows {'would be ' if dry else ''}removed")

        # 2. accounts — verify the email domain on every single one first.
        user_ids = manifest["ids"]["users"]
        safe: list[str] = []
        for i in range(0, len(user_ids), 50):
            chunk = user_ids[i : i + 50]
            r = client.get(
                f"{REST}/users",
                params={"id": f"in.({','.join(chunk)})", "select": "id,email"},
                headers=HEADERS,
            )
            r.raise_for_status()
            for row in r.json():
                email = (row.get("email") or "").lower()
                if email.endswith("@" + ds.SEED_DOMAIN):
                    safe.append(row["id"])
                else:
                    log(f"REFUSING to delete {row['id']} — email {email!r} is not "
                        f"on {ds.SEED_DOMAIN}")

        # 2b. an id in the manifest whose public.users row is already gone can
        #     still have an auth.users row behind it (that happened once when a
        #     transient 403 killed an earlier teardown mid-way). Check those by
        #     id against auth and apply the same email-domain rule.
        for uid in user_ids:
            if uid in safe:
                continue
            probe = admin_call(client, "GET", f"{AUTH}/admin/users/{uid}")
            if probe.status_code != 200:
                continue
            email = (probe.json().get("email") or "").lower()
            if email.endswith("@" + ds.SEED_DOMAIN):
                safe.append(uid)
                log(f"orphaned auth account {email} queued for removal")

        log(f"users           {len(safe)} accounts {'would be ' if dry else ''}removed")
        if not dry:
            for uid in safe:
                # Deleting the auth user cascades to public.users
                # (users.id REFERENCES auth.users ON DELETE CASCADE).
                r = admin_call(client, "DELETE", f"{AUTH}/admin/users/{uid}")
                if r.status_code not in (200, 204):
                    log(f"  auth delete {uid} → {r.status_code} {r.text[:120]}")
            # Belt and braces: drop any public.users row that survived.
            delete_ids(client, "users", safe, dry=False)

    log("done." if not dry else "dry run only — nothing was deleted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
