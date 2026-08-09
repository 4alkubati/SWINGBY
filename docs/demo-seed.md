# Demo seed data

A fictional Calgary marketplace you can switch on for a demo and switch off
afterwards. It exists so the app does not look empty: 15 businesses spread
across real neighbourhoods, open job posts, completed bookings with reviews,
and live chat threads.

Everything is invented — the names, addresses and 555 phone numbers belong to
no real business or person.

## Run it

```bash
cd backend
.venv/bin/python scripts/seed_demo.py            # seed or refresh
.venv/bin/python scripts/seed_demo.py --dry-run  # show counts, write nothing
.venv/bin/python scripts/seed_demo.py --verify   # count what is already there
```

Needs `SUPABASE_URL` plus `SUPABASE_SERVICE_KEY` (or `SUPABASE_SECRET_KEY`) in
`backend/.env`. Set `DEMO_SEED_PASSWORD` there too if you want to choose the
password for the demo accounts; otherwise the script generates one and prints
it once. Running from a git worktree, point it at the real env file with
`SWINGBY_ENV_FILE=/path/to/backend/.env`.

## Remove it

```bash
cd backend
.venv/bin/python scripts/teardown_demo.py --dry-run
.venv/bin/python scripts/teardown_demo.py --yes
```

## What it will and will not touch

* Every row is written with a deterministic uuid5 id, so re-running updates the
  same rows instead of creating duplicates.
* Every id it writes is recorded in `backend/scripts/demo_seed_manifest.json`.
  The teardown deletes only ids from that file.
* Every demo account is on the `demo.swingbyy.com` email domain and the
  teardown refuses to delete any account that is not.
* It never updates or deletes a row it did not create.

## Demo accounts

* Client: `nadia-whitfield@demo.swingbyy.com` — 4 bookings (one **in progress**),
  4 chat threads, 2 reviews written, 2 open job posts.
* Business owner: `tomas-ferreira@demo.swingbyy.com` — Beltline Shine Cleaning.

## The screenshot set (added 2026-08-05)

These App Store / marketing screenshots are shot at 1290×2796 (Apple's 6.9"
size), so the data behind them has to survive review, not just look tidy.
Three gaps were closed after querying the live database:

* **Nadia had no in-progress job**, so the live-tracking screen — the strongest
  screen in the app — could not be reached from the demo account.
  `bk-nadia-live-paint` is that job; its timeline deliberately stops at
  `started`, because adding `completed` greys out the progress rail.
* **Reviews were inconsistent with the counts.** Businesses advertised
  `review_count` of 33–141 while the reviews table held 8 rows, so a profile
  read "4.9 (63)" and then listed one review. `reviews.booking_id` is NOT NULL,
  so more reviews meant more completed bookings — hence the `bk-r*` block.
  Ratings are deliberately mixed (one 3-star with a fair complaint): a wall of
  5.0s reads as fabricated.
* **The open-jobs feed filters to the viewing business's own category**, so a
  thin category gave that owner a one-card screen. Extra open posts now cover
  Cleaning, Painting, Electrical and Landscaping.

Verified against the production API on 2026-08-05 — client sees 4 bookings,
5-event live timeline, 6-message live chat, 3 reviews, 4 threads, 10 open jobs;
Cleaning/Painting/Electrical owners see 3/2/2 jobs in their feeds.

**Proof-of-work photos are seeded, but they are placeholders.** `PHOTOS` in
`demo_dataset.py` writes 5 `booking_photos` rows — before/after on the two
completed jobs, before-only on the live one, which is what an in-progress
booking should honestly look like. The files live in the public `job-photos`
bucket under `demo/proof/` and each carries a **SAMPLE** mark on its face.

That mark is deliberate and should stay until real photos replace it: an App
Store screenshot showing photorealistic "completed work" is a claim about jobs
that never happened. Swapping in real tester photos changes only the files in
the bucket — the rows and their ids are derived from the booking slug and stay
put.

Log in as one of these, not as an admin account: `GET /bookings/` returns an
empty list for `role = admin`, so an admin login shows no bookings and no
message threads no matter how much data exists.

## Two traps this seed already works around

* **Email domain.** The API validates logins with pydantic `EmailStr`, which
  rejects reserved TLDs such as `.test`. Demo accounts on `demo.swingby.test`
  were created fine and then failed login with HTTP 422. Hence
  `demo.swingbyy.com`.
* **Intermittent `403 bad_jwt` from Supabase Auth admin.** Roughly one admin
  call in four on this project fails with "unrecognized JWT kid" and the same
  call succeeds a second later. Both scripts retry; without the retry a
  teardown can leave orphaned rows in `auth.users`.
