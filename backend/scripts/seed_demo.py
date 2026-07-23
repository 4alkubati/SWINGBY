"""
seed_demo.py — populate the SwingBy database with a fictional Calgary
marketplace for demos.

WHAT IT DOES
  * creates ~21 demo accounts (15 business owners + 6 clients), all on the
    `demo.swingbyy.com` email domain
  * creates 15 businesses spread across real Calgary neighbourhoods
  * creates 10 job posts, 9 bookings (6 completed), payments, 8 reviews,
    3 chat threads and 3 live-job timelines
  * writes backend/scripts/demo_seed_manifest.json listing EVERY id it
    touched, so teardown_demo.py can remove exactly this and nothing else

WHAT IT NEVER DOES
  * it never updates or deletes a row it did not create. Every write is an
    upsert keyed on a deterministic uuid5 id, so re-running is safe and
    produces no duplicates.

USAGE
    cd backend
    .venv/bin/python scripts/seed_demo.py            # seed (or refresh)
    .venv/bin/python scripts/seed_demo.py --dry-run  # print counts, write nothing
    .venv/bin/python scripts/seed_demo.py --verify   # count what is in the DB

ENV (read from backend/.env, never committed)
    SUPABASE_URL, SUPABASE_SERVICE_KEY   required
    DEMO_SEED_PASSWORD                   optional; password given to every demo
                                         account. If unset, a random one is
                                         generated and printed ONCE.
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))
import demo_dataset as ds  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]
MANIFEST_PATH = Path(__file__).resolve().parent / "demo_seed_manifest.json"

# backend/.env normally. SWINGBY_ENV_FILE overrides it — needed when the script
# runs from a git worktree, which has no untracked .env of its own.
load_dotenv(os.getenv("SWINGBY_ENV_FILE") or (BACKEND_DIR / ".env"))

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
# Legacy projects use SUPABASE_SERVICE_KEY (JWT service_role); newer ones use
# the SUPABASE_SECRET_KEY (sb_secret_…) API key. Either grants the writes
# this script needs — take whichever is populated.
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or ""

if not SUPABASE_URL or not SERVICE_KEY:
    sys.exit(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in backend/.env. "
        "Nothing was written."
    )

REST = f"{SUPABASE_URL}/rest/v1"
AUTH = f"{SUPABASE_URL}/auth/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def log(msg: str) -> None:
    print(f"[seed] {msg}", flush=True)


# ── auth accounts ───────────────────────────────────────────────────────────
def admin_call(client: httpx.Client, method: str, url: str, **kw) -> httpx.Response:
    """
    One GoTrue admin call, retried through the project's intermittent
    403 bad_jwt ("unrecognized JWT kid <nil> for algorithm ES256").
    Measured on 2026-07-23: roughly one call in four fails this way and the
    identical call succeeds a second later. Everything else is returned as-is.
    """
    resp = None
    for attempt in range(6):
        resp = client.request(method, url, headers=HEADERS, **kw)
        if not (resp.status_code == 403 and "bad_jwt" in resp.text):
            return resp
        time.sleep(1.0 + attempt)
    return resp


def ensure_account(client: httpx.Client, acct: dict, password: str) -> str:
    """
    Create (or refresh) one auth user with an explicit id. Returns the id that
    actually exists in auth.users afterwards.
    """
    body = {
        "id": acct["id"],
        "email": acct["email"],
        "password": password,
        "email_confirm": True,
        "user_metadata": {
            "first_name": acct["first_name"],
            "last_name": acct["last_name"],
            "role": acct["role"],
            "demo_seed": ds.SEED_TAG,
        },
    }
    r = admin_call(client, "POST", f"{AUTH}/admin/users", json=body)
    if r.status_code in (200, 201):
        return r.json()["id"]

    # Already exists → find it by email and reset its password/metadata.
    lookup = admin_call(
        client, "GET", f"{AUTH}/admin/users",
        params={"page": 1, "per_page": 1, "filter": acct["email"]},
    )
    existing = None
    if lookup.status_code == 200:
        for u in lookup.json().get("users", []):
            if (u.get("email") or "").lower() == acct["email"].lower():
                existing = u
                break
    if not existing:
        raise RuntimeError(
            f"could not create or find auth user {acct['email']}: "
            f"{r.status_code} {r.text[:200]}"
        )

    upd = admin_call(
        client, "PUT", f"{AUTH}/admin/users/{existing['id']}",
        json={
            "password": password,
            "email_confirm": True,
            "user_metadata": body["user_metadata"],
        },
    )
    if upd.status_code not in (200, 201):
        raise RuntimeError(
            f"could not update auth user {acct['email']}: "
            f"{upd.status_code} {upd.text[:200]}"
        )
    return existing["id"]


# ── table writes ────────────────────────────────────────────────────────────
def upsert(client: httpx.Client, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    r = client.post(
        f"{REST}/{table}",
        params={"on_conflict": "id"},
        json=rows,
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
    )
    if r.status_code not in (200, 201, 204):
        raise RuntimeError(f"{table} upsert failed: {r.status_code} {r.text[:400]}")


def count_rows(client: httpx.Client, table: str, ids: list[str]) -> int:
    """Exact count of the seeded ids that are actually present."""
    total = 0
    for i in range(0, len(ids), 50):
        chunk = ids[i : i + 50]
        r = client.get(
            f"{REST}/{table}",
            params={"id": f"in.({','.join(chunk)})", "select": "id"},
            headers=HEADERS,
        )
        r.raise_for_status()
        total += len(r.json())
    return total


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="build the dataset and print counts, write nothing")
    ap.add_argument("--verify", action="store_true",
                    help="only count seeded rows already in the database")
    args = ap.parse_args()

    data = ds.build(datetime.now(timezone.utc))

    if args.dry_run:
        for table in ds.INSERT_ORDER:
            log(f"{table:<15} {len(data[table])} rows")
        log(f"accounts        {len(data['accounts'])} auth users")
        return 0

    manifest = {
        "seed_tag": ds.SEED_TAG,
        "seed_domain": ds.SEED_DOMAIN,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "supabase_project_url": SUPABASE_URL,
        "ids": {t: [row["id"] for row in data[t]] for t in ds.INSERT_ORDER},
        "auth_user_ids": [a["id"] for a in data["accounts"]],
        "auth_user_emails": [a["email"] for a in data["accounts"]],
    }

    with httpx.Client(timeout=60.0) as client:
        if args.verify:
            for table in ds.INSERT_ORDER:
                ids = [row["id"] for row in data[table]]
                log(f"{table:<15} {count_rows(client, table, ids)}/{len(ids)} present")
            return 0

        password = os.getenv("DEMO_SEED_PASSWORD") or ""
        generated = False
        if not password:
            password = "Demo-" + secrets.token_urlsafe(12)
            generated = True

        log(f"creating {len(data['accounts'])} auth accounts…")
        for acct in data["accounts"]:
            real_id = ensure_account(client, acct, password)
            if real_id != acct["id"]:
                raise RuntimeError(
                    f"auth returned id {real_id} for {acct['email']} but the "
                    f"dataset expects {acct['id']} — aborting before any table "
                    f"writes so nothing is orphaned."
                )

        # The on_auth_user_created trigger already inserted a public.users row
        # from the metadata; this upsert fills in phone + created_at.
        for table in ds.INSERT_ORDER:
            rows = data[table]
            upsert(client, table, rows)
            log(f"{table:<15} {len(rows)} rows upserted")

        MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
        log(f"manifest written → {MANIFEST_PATH}")

        log("verifying…")
        ok = True
        for table in ds.INSERT_ORDER:
            ids = manifest["ids"][table]
            found = count_rows(client, table, ids)
            state = "OK" if found == len(ids) else "MISSING"
            if found != len(ids):
                ok = False
            log(f"  {table:<15} {found}/{len(ids)} {state}")

    if generated:
        log("")
        log("Demo account password (shown once, not stored in git):")
        log(f"    {password}")
        log(f"    e.g. login as  nadia-whitfield@{ds.SEED_DOMAIN}  (client)")
        log("Set DEMO_SEED_PASSWORD in backend/.env and re-run to choose your own.")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
