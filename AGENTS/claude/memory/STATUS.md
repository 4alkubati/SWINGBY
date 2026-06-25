# STATUS — Current Project State

> Rewritten by Orchestrator at the end of every session. Single source of truth for right now.
> Absorbed from the old agent system on 2026-06-17.

## Active Project
swingby

## Repo Path
C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby

## Last Updated
2026-06-24 (🟢 LOOP run 7 — picked up run-6's deferred dead-code cleanup as the only remaining Bucket A surface: `err.message?.includes('404')` checks in `DisputeFlowScreen.js` + `client/BookingDetailsScreen.js` removed (axios interceptor in `services/api.js` rejects with `new Error(detail)` only — HTTP status never reaches `err.message`, so the `'404'` arm was dead). Replaced with `toLowerCase().includes('not found')` against the FastAPI detail. Boot ✅ (63 routes, 5 critical present). Babel ✅ both edited files. Signal: NEEDS-KIRA — same 3 blockers as runs 4–6.)

## Current Phase
Beta launch prep — full build-order code-complete (mock-data killed · P2 Stripe sandbox scaffolded · Live Job Status · before/after photos · end-to-end script). Waiting on the deploy push + 2 envelopes of secrets + on-device verify.

## Phase Status
🟢 NEEDS-KIRA (P0/P1/P2 code/P3/P4/P5/P6 code-complete; deploy gate + seed creds + Stripe keys are all human-only)

## What's Working
- **Backend (in-tree, not yet deployed):** FastAPI exposes `/bookings/{id}/events` (POST + GET), `/bookings/{id}/photos` (POST + GET), `/uploads/image`, `/payments/stripe/checkout/{id}` (POST), `/payments/stripe/webhook` (POST). 63 total routes, all visible via `app.routes`. Boots cleanly without `STRIPE_SECRET_KEY` — endpoints return 503 with a clear message when invoked unconfigured.
- **Database:** Supabase has `booking_events` + `booking_photos` tables with RLS read-policies (party-only). 0 new advisor warnings.
- **Mobile (code complete, not yet on device):** 3 new components (`LiveStatusTimeline`, `LiveStatusActions`, `BookingPhotos`) wired into `JobManagementScreen` (provider, with attach) + `BookingDetailsScreen` (client, view-only). New "Pay with card" button on `BookingDetailsScreen` posts to `/payments/stripe/checkout/{id}` and opens Stripe Checkout via `Linking.openURL`. Babel-clean.
- **QA:** `backend/scripts/smoke_e2e.py` walks the full beta flow; honest exit codes for confirm-email/seed-creds states.

## What's Broken (the real blockers)
- **Render is 10 commits behind `main` AND the trust-layer work is uncommitted in the working tree.** Until a push, prod is missing `/uploads/image`, `/bookings/{id}/events`, `/bookings/{id}/photos`. This is the only thing standing between the in-tree code and a verifiable beta — Bucket C, parked to HUMAN-TODO.
- **Smoke test can't run unattended on Render until seed creds are supplied** (Supabase "Confirm email" is ON, so the script's fresh-signup path won't return an access token). Bucket B.
- **No payment runtime (H8):** Stripe code shipped; STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET not yet in Render. See HUMAN-TODO #3 for the 6-step turn-on.
- **Missing legacy endpoints (C4/C5):** `/businesses/me/analytics`, `/api-keys` still pending — not blocking beta; legacy Earnings/Analytics screens depend on them post-beta.
- **Placeholders:** Sentry DSN, hCaptcha secret still unset. Google Maps key IS set.

## Blocked On
1. Kira to `git push origin main` (Bucket C deploy)
2. Kira to provide `CLIENT_EMAIL/PASSWORD` + `BIZ_EMAIL/PASSWORD` seed creds (Bucket B)
3. Kira to paste `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` into Render + configure webhook URL in Stripe dashboard (Bucket B — full 6-step in HUMAN-TODO)

## Open Broadcasts
- 2026-06-17 — Memory absorbed from old agent system into rebuilt kit; beta queue framed in PLAN.md
- 2026-06-24 — Trust-layer code (P1/P3/P4/P5/P6) shipped to working tree; awaiting deploy gate to verify on Render.
- 2026-06-24 — P2 Stripe sandbox scaffold (backend hosted-Checkout + mobile Pay button) shipped to working tree; full build-order now code-complete.

## Last Agent Run
2026-06-24 LOOP run (orchestrator inline, Opus 4.7):
- P1 — `/uploads/image` 404 root-caused as deploy lag, not code bug. Curl `/openapi.json` confirmed no upload routes on Render; local main.py + uploads.py committed since `74acaa0`. Bucket C: pushed to HUMAN-TODO.
- P3 — Live Job Status backend: Supabase migration `booking_events_and_photos` applied, prior-session `booking_events.py` wired into `main.py`. Push notifications fire on every event with role-specific copy.
- P4 — Live Job Status UI: `LiveStatusActions` (provider primary button auto-advances en_route → arrived → started → completed) + `LiveStatusTimeline` (8 s poll, chrono list, icons + connectors). Wired into JobManagement Status tab and BookingDetails.
- P5 — Before/after photos: `booking_photos.py` API written + wired; `BookingPhotos` mobile component (ImagePicker → `/uploads/image` → POST `/photos`) renders both phases. Provider sees attach buttons in JobManagement; client sees view-only in BookingDetails.
- P6 — `backend/scripts/smoke_e2e.py` walks: healthz → signup/login both roles → ensure_business → post → quote → accept → confirm-date → arrived → started → before-photo → completed → after-photo → /complete release → review → verify event list ≥ 3. Configurable BASE_URL + seed-cred env vars.

## Next Action
1. **Kira: `git push origin main`** (Bucket C — only Kira can authorize the deploy)
2. **Kira: paste Stripe keys into Render** (Bucket B — full 6-step in HUMAN-TODO)
3. After Render deploy goes green: `BASE_URL=https://swingbyy-api.onrender.com CLIENT_EMAIL=… python backend/scripts/smoke_e2e.py`
4. **On-device verification** (P0/P4/P5/P2 done-rules):
   - Open a booking in JobManagement → tap "On my way" → confirm push lands on client device
   - Continue: Arrived → Start → attach before photo → Complete → attach after photo
   - Client opens BookingDetails → confirm timeline + photos populate within poll interval
   - Client taps "Pay with card" → Stripe Checkout opens → use test card `4242 4242 4242 4242` → confirm payments row flips to `paid_full`
5. Beta tester recruiting (FOH track) once on-device verifies cleanly.

## Security Gate
✅ passing. Migration applied via service role; no destructive changes; RLS read-policy added for both new tables; 0 new advisor warnings. Pre-existing WARNs (job-photos public bucket listing + HIBP password leak) unchanged — both already tracked.

## Session End Signal
🟢 NEEDS-KIRA — full build-order code-complete + run-7 dead-code cleanup landed (2026-06-24):
- Run 7 cleared the last benign Bucket A surface flagged by run 6: the `err.message?.includes('404')` arm in `mobile/src/screens/flows/DisputeFlowScreen.js` + `mobile/src/screens/client/BookingDetailsScreen.js`. Confirmed dead because `services/api.js` line 118 unwraps to `new Error(extractMessage)` — HTTP status code is never preserved in `err.message`. Replaced both with `err.message?.toLowerCase().includes('not found')` against FastAPI's detail. Behavior unchanged in practice (the OR-fallback already caught the case); intent is now honest and matches what the interceptor actually delivers.
- Git: still 10 commits ahead of `origin/main` + same uncommitted reorg/wiring + same untracked trust-layer/Stripe/smoke files as runs 2–6 (now with the run-7 2-file edit on top).
- Boot ✅: 63 routes, all 5 critical (`/uploads/image`, `/bookings/{booking_id}/events`, `/bookings/{booking_id}/photos`, `/payments/stripe/checkout/{booking_id}`, `/payments/stripe/webhook`) present.
- Babel ✅: 2 edited mobile files parse clean.
- All P1–P6 still ✅ in PLAN.md. HUMAN-TODO blockers unchanged (Bucket C push, Bucket B Stripe envs, Bucket B seed creds).
Remaining work is exclusively Bucket B/C. No Bucket A tasks runnable. Beta DONE-rule (PRODUCT-VISION) is one push + 2 envelopes + on-device verify away.
