#!/usr/bin/env python3
"""seed_walkthrough.py — one client's journey, end to end, for filming.

    .venv/bin/python scripts/seed_walkthrough.py --dry-run
    .venv/bin/python scripts/seed_walkthrough.py
    .venv/bin/python scripts/seed_walkthrough.py --verify
    .venv/bin/python scripts/seed_walkthrough.py --teardown

WHY THIS EXISTS ALONGSIDE seed_demo.py
--------------------------------------
`seed_demo.py` builds a believable *marketplace* — 15 businesses, 22 bookings,
enough breadth that any screen has something on it. What it cannot do is tell a
*story*, and a walkthrough is a story: one person, one job, in order.

Two concrete gaps it leaves, both of which show up on camera:

1. **No quotes.** The demo seed goes straight from `service_posts` to
   `bookings`, and never writes the `interests` table — which is where a quote
   actually lives (`app/api/interests.py`: post_id, business_id, quoted_price,
   status). So no post in the database has an un-accepted quote sitting on it,
   and "3 quotes came in" — the payoff of the whole client story — is an empty
   screen. This script writes them.

2. **Titles that read as test data.** Filming caught `Jiiiii hmh muhbb`,
   `Hahahaha plus I need those` and five variations of "I need help moving" on
   one screen. Nothing is wrong with the data; it just looks like nobody uses
   the product. Here every title is something a Calgary homeowner would type.

SAFETY — the same contract seed_demo.py keeps
---------------------------------------------
Every id is a deterministic uuid5, so re-running upserts rather than duplicates.
Every id written is recorded in walkthrough_seed_manifest.json, and --teardown
removes exactly what that file lists and nothing else. This never updates or
deletes a row it did not create.

It uses its OWN namespace, so it cannot collide with the demo seed's ids, and
its accounts are on the same demo domain so they are obviously not real people.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
import uuid
from datetime import datetime, timedelta, timezone

HERE = pathlib.Path(__file__).resolve().parent
BACKEND_DIR = HERE.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(HERE))

# Same as seed_demo.py: the service key lives in backend/.env and nothing
# imports it for us. Loading it here rather than relying on the ambient
# environment is what makes this runnable from cron and from a shell alike.
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.getenv("SWINGBY_ENV_FILE") or (BACKEND_DIR / ".env"))

SEED_TAG = "swingby-walkthrough-v1"
SEED_DOMAIN = "demo.swingbyy.com"
_NS = uuid.uuid5(uuid.NAMESPACE_URL, f"https://swingby.app/{SEED_TAG}")
MANIFEST = HERE / "walkthrough_seed_manifest.json"


def wid(kind: str, slug: str) -> str:
    return str(uuid.uuid5(_NS, f"{kind}:{slug}"))


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


# ── the cast: BORROWED, NOT CREATED ─────────────────────────────────────────
# The first draft of this script invented its own client and businesses. That is
# wrong in a way that only shows up when you try to film: creating a row in
# `users` does NOT create an auth account, so the star of the walkthrough could
# not have logged in. Making auth accounts here would also duplicate work
# seed_demo.py already does properly.
#
# So the journey hangs off accounts that already exist and can already sign in —
# the client HANDOFF-video.md already says to film as, and businesses from the
# same seed. This script therefore writes only the two things the demo seed
# genuinely lacks: better posts, and the quotes sitting on one of them.
# noqa E402 below: this import sits under the sys.path setup it needs, and it
# borrows the demo seed's namespace rather than inventing a second one.
from demo_dataset import did as demo_id  # noqa: E402

CLIENT_SLUG = "nadia-whitfield"  # already seeded, already has auth
# Owner slugs, which are what did("business", ...) is keyed on — NOT the
# display names. The three are the ones a driveway-clearing job would actually
# reach: the seed already contains a snow specialist, and the two landscapers
# are the crews that plough in winter and cut grass in summer.
QUOTING_BUSINESSES = [  # (owner slug, invented price)
    ("grant-whitlock", 165.0),  # Hillhurst Snow & Ice
    ("sofia-bertrand", 190.0),  # Auburn Bay Yardworks
    ("marisol-vega", 150.0),  # Bow Ridge Lawn & Yard
]

# ── the journey ─────────────────────────────────────────────────────────────
# Three posts at three different stages, so a single scroll of "My Jobs" shows
# a life rather than a list: one waiting on quotes, one booked and running, one
# finished and waiting on approval.
POSTS = [
    # slug, title, category, budget, address, lat, lng, days_ago, pref_in, status, description
    (
        "wt-post-driveway-snow",
        "Driveway and walk cleared after every snowfall",
        "Snow Removal",
        180.0,
        "412 Evanston Dr NW, Calgary, AB",
        51.1712,
        -114.1077,
        0,
        2,
        "open",
        "Double driveway plus the front walk and steps. Looking for someone to "
        "come after each snowfall through the winter, not a one-off.",
    ),
    (
        "wt-post-fall-yard",
        "Fall cleanup before the snow comes",
        "Landscaping",
        220.0,
        "78 Montgomery Way NW, Calgary, AB",
        51.0870,
        -114.1740,
        6,
        3,
        "matched",
        "Leaves bagged, beds cut back and the gutters cleared. Corner lot, so "
        "there is a fair bit of it.",
    ),
    (
        "wt-post-deep-clean",
        "Deep clean of a 3-bed before family arrives",
        "Cleaning",
        300.0,
        "1140 Kensington Rd NW, Calgary, AB",
        51.0534,
        -114.0870,
        14,
        1,
        "matched",
        "Kitchen, three bathrooms and the basement. Family staying over the long "
        "weekend so it needs doing before Friday.",
    ),
]

# The screen the demo seed could never populate: quotes on an OPEN post.
# Prices are invented, and deliberately spread — a walkthrough where every
# quote is the same number teaches nothing about picking one.
QUOTE_POST = "wt-post-driveway-snow"  # the OPEN one — quotes only live here


def build(now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    cid = demo_id("user", CLIENT_SLUG)

    posts = []
    for pslug, title, cat, budget, addr, lat, lng, ago, pref, status, desc in POSTS:
        posts.append(
            {
                "id": wid("post", pslug),
                "client_id": cid,
                "title": title,
                "description": desc,
                "category": cat,
                "budget": budget,
                "status": status,
                "lat": lat,
                "lng": lng,
                "address": addr,
                "preferred_date": _iso(now + timedelta(days=pref)),
                "geocoded_at": _iso(now - timedelta(days=ago)),
                "geocode_source": "manual",
                "image_urls": [],
                "expires_at": _iso(now + timedelta(days=pref + 7)),
                "created_at": _iso(now - timedelta(days=ago)),
                "target_business_id": None,
            }
        )

    quotes = []
    for i, (bslug, price) in enumerate(QUOTING_BUSINESSES):
        quotes.append(
            {
                "id": wid("interest", f"{QUOTE_POST}:{bslug}"),
                "post_id": wid("post", QUOTE_POST),
                "business_id": demo_id("business", bslug),
                "quoted_price": price,
                "status": "pending",
                "created_at": _iso(now - timedelta(hours=6 - i * 2)),
            }
        )

    return {"service_posts": posts, "interests": quotes}


TABLES = ["service_posts", "interests"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--teardown", action="store_true")
    a = ap.parse_args()

    data = build()

    if a.dry_run:
        print(f"[walkthrough] tag {SEED_TAG}")
        for t in TABLES:
            print(f"  {t:<16} {len(data[t]):>3}")
        print("\nposts:")
        for p in data["service_posts"]:
            print(f"  [{p['status']:<7}] {p['title']}  ${p['budget']:.0f}")
        print("\nquotes on the open post:")
        for q in data["interests"]:
            print(f"  ${q['quoted_price']:.0f}  {q['status']}")
        return 0

    # REST directly, exactly as seed_demo.py does — NOT app.supabase_client.
    # That module reads only SUPABASE_SERVICE_KEY, and this project's .env has
    # that name present but EMPTY; the live value is under the newer
    # SUPABASE_SECRET_KEY. seed_demo.py already accepts either, so this follows
    # the path that is known to work rather than the one that looks tidier.
    import httpx  # noqa: E402

    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or ""
    if not url or not key:
        print("✗ SUPABASE_URL and a service key must be set in backend/.env")
        return 1
    REST = f"{url}/rest/v1"
    H = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    client = httpx.Client(timeout=60.0)

    if a.verify:
        for t in TABLES:
            ids = [r["id"] for r in data[t]]
            r = client.get(
                f"{REST}/{t}",
                params={"id": f"in.({','.join(ids)})", "select": "id"},
                headers=H,
            )
            r.raise_for_status()
            print(f"[walkthrough] {t:<16} {len(r.json())}/{len(ids)} present")
        return 0

    if a.teardown:
        man = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else None
        if not man:
            print("no manifest — refusing to guess what to delete")
            return 1
        for t in reversed(TABLES):
            ids = man["ids"].get(t, [])
            if ids:
                r = client.delete(
                    f"{REST}/{t}", params={"id": f"in.({','.join(ids)})"}, headers=H
                )
                r.raise_for_status()
                print(f"[walkthrough] removed {len(ids)} from {t}")
        return 0

    for t in TABLES:
        rows = data[t]
        if rows:
            r = client.post(
                f"{REST}/{t}",
                json=rows,
                headers={**H, "Prefer": "resolution=merge-duplicates"},
            )
            if r.status_code >= 300:
                print(f"✗ {t}: {r.status_code} {r.text[:300]}")
                return 1
            print(f"[walkthrough] upserted {len(rows):>3} into {t}")

    MANIFEST.write_text(
        json.dumps(
            {
                "seed_tag": SEED_TAG,
                "seed_domain": SEED_DOMAIN,
                "generated_at": _iso(datetime.now(timezone.utc)),
                "ids": {t: [r["id"] for r in data[t]] for t in TABLES},
            },
            indent=2,
        )
    )
    print(f"[walkthrough] manifest -> {MANIFEST.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
