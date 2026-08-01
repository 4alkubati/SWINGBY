# If we launched tomorrow — what actually breaks

**Audit date: 2026-07-31.** Scope is the **codebase only** — Kira's instruction:
"forget subscriptions like render or anything like it, I am talking about the
codebase."

Everything below was found by running something, not by reading docs. Where a
claim is unverified it says so.

> **What was verified working, so it is not on this list:** the full booking
> loop. `tools/e2e_smoke.py` was run against a local backend on this branch and
> the live Supabase project: **32/32 PASS** — login, post, quote, pre-booking
> chat, accept, booking joins, propose/confirm date, self-confirm blocked (403),
> en-route event, the unpaid-completion money guard (409), payment, completion.
> The core journey is not the risk.

Severity: **S1** = launch is dead or money is wrong · **S2** = a real user hits
it on day one · **S3** = wrong or embarrassing, not fatal.

---

## The three that would actually take us down

### M6 — Supabase key rotation kills the backend at boot · S1 · ✅ FIXED
`config.py` requires `SUPABASE_SERVICE_KEY` / `SUPABASE_KEY` — the **legacy**
names. Supabase has moved to `sb_publishable_…` / `sb_secret_…`, and **Kira's
own `backend/.env` has already made the switch**: `DATABASE_URL`,
`SUPABASE_KEY`, `SUPABASE_SERVICE_KEY` and `SECRET_KEY` are all **empty
strings**, with `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` /
`SUPABASE_JWKS_URL` set instead.

Consequences, in order of how much they hurt:
1. The backend **cannot start from a fresh clone** with the current `.env` —
   `config.py:26` raises `RuntimeError` at import. The command in CLAUDE.md and
   `docs/RUNNING_LOCALLY.md` does not work.
2. The moment the legacy keys are disabled on the Supabase project, **Render
   dies on boot** and there is no fallback. Not a slow degradation — the process
   refuses to start.

**Verified:** I mapped `SUPABASE_SECRET_KEY` onto the old name and booted the
app — `POST /auth/login` returned 200 with a real token. **The new key is a
drop-in.** The only thing broken was the variable *name*, which is why this was
cheap to fix rather than a rewrite.

### M8 — a production build with no API URL silently points at localhost · S1 · ✅ FIXED
```js
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000';
```
That fallback is the bug. `mobile/eas.json` sets `SENTRY_DISABLE_AUTO_UPLOAD`
in every profile and **`EXPO_PUBLIC_API_URL` in none of them** — it has to come
from the EAS dashboard environment. If it is missing or misspelled for the
`production` environment, the shipped app points every request at the phone's
own loopback address. Nothing warns, at build time or at run time; the user just
sees "Network Error" on every screen forever, and it looks like their wifi.

This is the single most likely way tomorrow's build is dead on arrival, and the
one we would waste the most time diagnosing.

### M7 — `/health` reports on a database nothing uses · S2 · ✅ FIXED
The `"database"` field comes from a SQLAlchemy `engine.connect()` over
`DATABASE_URL`. `engine` is imported in exactly one place — that health check.
**Every real query in the app goes through PostgREST** with the Supabase key.

So the monitoring signal is not connected to the thing being monitored: with
`DATABASE_URL` empty (as it is now) `/health` screams `"Database unavailable"`
while the app is perfectly healthy, and a genuine PostgREST outage reports
`"ok"`. Any launch-day dashboard built on this is lying in both directions.

---

## Money

### M1 — escrow released without the client · S1 · ✅ FIXED (PR #82)
Business "Complete" moved the money while the pay sheet promised otherwise.
Client approves, or 24h auto-release.

### M2 — no card on file · S2 · **OPEN — needs decision D4**
No SetupIntent, no payment-method endpoints, `users.default_payment_method_id`
never written. A card is retained only as a side effect of paying once, and
there is no way to see or remove it. Every repeat booking re-enters a card.

### M3 — no Apple Pay, no Google Pay · S2 · **OPEN — needs decision D3**
`merchantIdentifier` empty, `enableGooglePay: false`. On iOS this is the
payment method most users expect to see.

### M4 — payment falls out to a browser · S2 · **OPEN**
When the native sheet is unavailable, `acceptAndPay.js` opens hosted Checkout in
a browser. Legal under 3.1.3(e), and it is where the unpaid bookings in the
walkthrough came from — the user leaves the app and does not come back.

### M5 — dashboard "THIS WEEK" counted unpaid bookings · S3 · ✅ FIXED (PR #82)

### M10 — the pay sheet computed money on the device · S2 · ✅ FIXED
`PaySheet.fetchPayQuote` had always called `POST /payments/quote`; the endpoint
did not exist, so the client caught the 404 and priced the sheet **on the
device**.

That was only accidentally right — the device knows nothing about credits
(`redeem_credit_for_booking` is written and gated off), so the first
server-side change to the amount would have had the sheet confidently showing a
price we do not charge. The endpoint is built. Two things it deliberately does:
the price is re-read from the booking/interest row rather than trusted from the
request body (otherwise it is a discount API), and lines carry a **translation
key** rather than English text, because the server owns the numbers and the
device owns the language.

### M11 — credits can be granted and seen, but not spent · S3 · **OPEN — D6**
`CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED = False`. A client owed $25 after a
business no-shows now sees the balance (PR #82) and still cannot use it. The
in-app copy tells them to contact us, which is honest but is a support ticket
per credit.

---

## Reachability — built, merged, connected to nothing

### M12 — `expiry_sweep` never ran · S1 · ✅ FIXED (PR #82)
### M13 — ghost mode unreachable while promised in the privacy policy · S2 · ✅ FIXED (PR #82)
### M14 — `POST /auth/social/role` had no caller · S2 · ✅ FIXED (PR #82)
### M15 — `GET /reviews/client/{id}` · S3 · ✅ SECURED (UI deliberately not added)
The last unreferenced route — and reviewing it turned up something worse than
being unused: **no authorisation at all.** Any logged-in account could read any
client's review history by id.

It now allows only the client themselves, an admin, or a business that has
actually been booked by that client. No screen calls it, on purpose: every
pre-acceptance surface a business sees is deliberately anonymised
(`privacy.mask_service_post_row`), so shipping a UI here would undo that masking
from a different direction. Guarded API, no leak.

> **There is still no scheduler in this deployment.** No cron service, no
> worker, no APScheduler. Anything time-based must settle lazily on read. Do not
> add a feature that assumes a timer exists.

---

## Screens and clients

### M16 — the walkthrough's screen defects (P1–P5) · S3 · ✅ FIXED (PR #82)
### M17 — consent, maps and Apple-sign-in platform split (X1/X3/X4) · S2 · ✅ FIXED (PR #82)

### M18 — non-auth writes had a 10s timeout and no retry · S3 · ✅ FIXED
`api.js` retries GETs three times with backoff, so a read had ~43s of budget
and a cold start was survivable. A write is never retried — replaying a POST
that may already have committed is how you double-post a job — so its 10s was
the entire budget. Writes now get the same 30s `/auth/*` already used, for
exactly the same reason: they are the requests that cannot be retried.

### M19 — `GET /messages/threads` was unbounded · S3 · ✅ FIXED
`list_threads` assembled every booking thread plus every quote thread the user
had ever had, in Python, on the screen every user opens. Capped at 50 (max 200),
applied **after** the newest-first sort so it drops the oldest rather than an
arbitrary slice, and it returns `total` so a client can tell "all of them" from
"the newest 50".

### M20 — Arabic was 21% untranslated · S3 · ✅ FIXED
Both `ar` and `fr-CA` were 98 keys behind — the **entire** payment/booking
block, so the pay sheet and the whole post-a-job flow fell back to English at
the exact moment money is explained. Both are **468/468** now, and the coverage
test is an equality assertion rather than a 30% ratchet, so the gap cannot creep
back one key at a time.

Fixing it surfaced a separate defect: `pay.escrow`, shown before every charge,
promised *"cancel free up to 24 h before"* when the real ladder is **48 h**. A
client cancelling 25 h out, trusting that line, was charged a 25% fee they had
been told did not apply. Corrected in English first, then translated.

---

## What I checked that turned out fine

Worth recording so nobody re-audits them:

- **Every mobile API call resolves to a real backend route** — 150 call sites
  against 129 routes; the only true miss is M10.
- **No unauthenticated routes** beyond the ones that must be public (signup,
  login, refresh, forgot-password, the three social endpoints, the Stripe
  webhook, waitlist, contact, the Google OAuth bridge).
- **Booking dates are timezone-safe** — the client sends `toISOString()` (UTC)
  and renders with `toLocaleString`, so no naive local-time strings are stored.
- **`ReviewCard`'s `name[0].toUpperCase()`** cannot crash — `reviewerName()`
  falls through to `'Client'` on any falsy value.
- **Cold starts are mostly handled** — GET retry with backoff, 30s on `/auth/*`.
  (The gap is writes: M18.)
- **Sentry is wired** on both sides (`EXPO_PUBLIC_SENTRY_DSN`, `settings.SENTRY_DSN`).

---

## Sentinel sweep — 2026-08-01

Seven findings, swept at `80ffb75` (main), which predates PR #82.

| Finding | Status |
|---|---|
| Tab-bar badge vs Dashboard pill disagree on cancelled threads | ✅ fixed — one status constant, three readers |
| Home bell shows a permanent "new activity" dot | ✅ removed (nothing truthful to gate it on) |
| "This week" hero counts gross, not-yet-earned money | ✅ **already fixed in PR #82** — pinned by a test |
| Discovery screens label `review_count` as "jobs" | ✅ relabelled to "reviews" on all four |
| Admin Businesses page calls routes that don't exist | ✅ `GET /admin/businesses` + verify built |
| Admin "Force complete" posts to the wrong path | ✅ path fixed, error surfaced |
| Admin Audit Log shows fabricated rows as real | ✅ `PLACEHOLDER_ROWS` deleted, `GET /admin/audit-log` built |

Also fixed while translating: the pay sheet promised **"cancel free up to 24 h"**
against a real **48 h** policy — a client cancelling 25 h out was charged a 25%
fee they had been told did not apply.

`web/admin/` is **not deployed** (docs/DEPLOY.md), so the three admin findings
were not on fire. They are fixed because that page is the only UI for the manual
licence verification CLAUDE.md documents, and a compliance screen that invents
its own contents is worse the day someone deploys it.

---

## The honest summary

Nothing in the **core booking journey** is broken — it passes end to end. The
launch risks are at the edges: **configuration that fails silently** (M6, M8),
**monitoring that reports on the wrong thing** (M7), and **payment convenience
that does not exist yet** (M2, M3, M4).

**Everything that does not need a decision is now closed.** M6, M7, M8, M10,
M15, M18, M19 and M20 are fixed on this branch, along with all seven Sentinel
findings.

**Four remain, and three of them are Kira's call, not a coding task:**
- **M2** card-on-file — decision **D4**
- **M3** Apple Pay / Google Pay — decision **D3**, plus a merchant id
- **M11** credit redemption — decision **D6** (the switch exists; turning it on
  needs the capture path verified in Stripe, and it has a known hole where an
  abandoned checkout keeps the credit spent)
- **M4** browser checkout fallback — largely disappears once M2/M3 land, since
  the fallback exists precisely because the native sheet may be unavailable
