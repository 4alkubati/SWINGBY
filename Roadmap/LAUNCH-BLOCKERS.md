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

### M10 — the pay sheet computes money on the device · S2 · **OPEN**
`PaySheet.fetchPayQuote` calls `POST /payments/quote`. **That endpoint does not
exist** (confirmed by sweeping all 129 backend routes). The code knows, and
falls back to a single un-itemised line marked `provisional`.

Today the number it shows equals what the server charges, so nothing is *wrong*
— but the client sees no fee breakdown before paying, and the moment anything
server-side changes the amount (credit redemption is already written and gated
off by `CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED`) the sheet will confidently show
a price we do not charge. Build the endpoint or delete the call.

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
### M15 — `GET /reviews/client/{id}` · S3 · **OPEN**
The last unreferenced route. A business cannot see a client's history before
quoting. Wire it or delete it — it must not sit in the tree looking finished.

> **There is still no scheduler in this deployment.** No cron service, no
> worker, no APScheduler. Anything time-based must settle lazily on read. Do not
> add a feature that assumes a timer exists.

---

## Screens and clients

### M16 — the walkthrough's screen defects (P1–P5) · S3 · ✅ FIXED (PR #82)
### M17 — consent, maps and Apple-sign-in platform split (X1/X3/X4) · S2 · ✅ FIXED (PR #82)

### M18 — non-auth writes have a 10s timeout and no retry · S3 · **OPEN**
`api.js` retries GETs three times on network errors and gives `/auth/*` a 30s
timeout, so a cold start is mostly survivable. A **write** is neither: a POST on
a sleeping or slow backend fails at 10s with no retry. The likeliest victim is
someone reopening the app after hours whose first action is posting a job.
Cheap fix: raise the base timeout and let explicitly-idempotent writes retry
(the `X-Send-Retry` header already exists for exactly this).

### M19 — `GET /messages/threads` is unbounded · S3 · **OPEN**
`list_threads` takes no `limit`. Fine at ten bookings; it is the query that
degrades first as volume grows, and it is on the inbox every user opens.

### M20 — Arabic is 21% untranslated · S3 · **OPEN**
`i18n-coverage` reports `ar: 363/461 keys — 98 missing`. Fallback is English, so
nothing crashes, but the language picker offers Arabic and then shows English
mid-screen. Either finish the keys or drop Arabic from the picker before launch;
offering a language we have not finished is worse than not offering it.

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

## The honest summary

Nothing in the **core booking journey** is broken — it passes end to end. The
launch risks are at the edges: **configuration that fails silently** (M6, M8),
**monitoring that reports on the wrong thing** (M7), and **payment convenience
that does not exist yet** (M2, M3, M4).

M6, M7 and M8 are fixed on this branch. M2/M3 need decisions from Kira before
any code is worth writing.
