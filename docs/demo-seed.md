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

* Client: `nadia-whitfield@demo.swingbyy.com` — 3 bookings, 3 chat threads,
  2 reviews written, 2 open job posts.
* Business owner: `tomas-ferreira@demo.swingbyy.com` — Beltline Shine Cleaning.

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
