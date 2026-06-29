# STATUS — Current Project State

> Rewritten by Orchestrator at the end of every session. Single source of truth for right now.
> Rewritten 2026-06-27 (D2.5 cleanup): stripped 9 stale frozen-on-Kira appends from runs 15–23. The 4 mobile fixes + CHECK bug they kept claiming were uncommitted are SHIPPED (commits `214fdb6`, `340e537`). The loop was lying.

## Active Project
swingby

## Repo Path
C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby

## Last Updated
2026-06-28 — D2.1 code-complete (backend endpoint + mobile rewrite), awaits Kira push + on-device verify

## Current Phase
**Phase 1 — BETA.** Build order moved from PLAN.md (P1–P6 done) to [[../../Roadmap/DOMINOES]] (D2.0–D5). Currently between dominoes:
- ✅ D1 — Email sends (commit `08715e3`)
- ✅ D2 — Kill mock data (verified zero mock strings in `mobile/src/screens/`)
- 🟡 D2.0 — Live walkthrough audit (waits on Kira's iPhone)
- 🟡 D2.5 — STATUS/HUMAN-TODO/daily files cleanup (in progress this turn)
- ⬜ D2.1–D2.4 — employee trust card, invoices, off-platform pay, business subscription
- ⬜ D3/D4/D5 — Expo Go walkthrough → friend tester → paid testers

## Phase Status
🟢 BUILD-READY — D2.1 employee trust card code-complete this session (backend `GET /employees/{id}/profile` + mobile EmployeeProfileScreen rewrite). Awaits Kira push to ship to Render + on-device verify. D2.2 (invoices) is next runnable code domino. D2.0 still waits on Kira's iPhone walkthrough.

## What's Working (deployed surface)
- **Backend (LIVE on Render `swingbyy-api.onrender.com`):** 50 routes — `/uploads/image`, `/bookings/{id}/events` (POST + GET), `/bookings/{id}/photos` (POST + GET), `/payments/stripe/checkout/{id}` (POST), `/payments/stripe/webhook` (POST), `/contact/`, full auth surface. Stripe routes return 503 with clear remediation copy until keys set in Render env.
- **Database:** Supabase 10 tables + `booking_events` + `booking_photos` + 5 lifecycle email triggers wired. RLS on every table. `bookings.payment_status` CHECK extended to allow `refunded` (commit `340e537`).
- **Email:** Resend wired. Branded magic link delivers from `team@swingbyy.com`. 5 lifecycle emails on signup, booking confirm (both sides), forgot password, contact form.
- **Mobile (code complete, awaits on-device verify in D2.0):** Live status timeline + actions + before/after photos wired into `JobManagementScreen` (provider) and `BookingDetailsScreen` (client). Pay-with-card button posts to Stripe Checkout. `paymentPillStyle`/`paymentPillLabel` aligned to schema enum (commit `214fdb6`).
- **QA:** `backend/scripts/smoke_e2e.py` walks the full beta flow with honest exit codes for confirm-email + seed-creds states.

## What's Broken (real blockers)
- **Bucket B — seed accounts missing.** `auth.users` has zero rows for `client@swingby.app`, `business@swingby.app`, `employee@swingby.app`. Documented in `credentials/test-accounts/seed-accounts.md`. Smoke test cannot run against Render until these exist. HUMAN-TODO item.
- **Bucket B — Stripe keys missing.** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` not in Render env. Pay-with-card returns 503 in production. HUMAN-TODO item with 6-step turn-on.
- **Bucket B — DMARC TXT record missing on swingbyy.com.** Emails risk spam folder. HUMAN-TODO item.
- **D2.0 walkthrough not done.** No live ground-truth on what the deployed app actually looks like to a tester. Waiting on Kira's iPhone via Expo Go.
- **Placeholders unset:** Sentry DSN, hCaptcha secret. Google Maps key IS set.

## Blocked On
1. Kira's iPhone for D2.0 walkthrough audit
2. Kira to create 3 seed accounts in Supabase Auth dashboard (Auto-Confirm ON)
3. Kira to paste Stripe keys into Render + configure webhook in Stripe dashboard
4. Kira to push the D2.5 cleanup commit (Bucket C)

## Open Broadcasts
- 2026-06-21 — D1 email lifecycle wired (commit `08715e3`)
- 2026-06-24 — Trust layer (events + photos) + Stripe sandbox scaffold (commit `554453b`)
- 2026-06-25 — Mobile fixes + CHECK bug shipped (commits `214fdb6`, `340e537`)
- 2026-06-26 — DOMINOES plan created; D2.0–D2.5 scoped
- 2026-06-27 — D2.4 NEEDS-KIRA locked: customer 10% + business membership ($30 solo / $80 team / Enterprise), gate on Accept

## Last Agent Run
**2026-06-27 — D2.5 housekeeping + D2.4 decisions captured (inline, Claude Opus 4.7):**
- Read DOMINOES + STATUS + HUMAN-TODO + PRODUCT-VISION + LOOP + 9 memory files.
- Captured Kira's D2.4 monetization model into the domino file.
- Rewrote this STATUS to reflect git-log truth instead of run-15–23 noise.
- Rewrote HUMAN-TODO to tick off shipped items + add D2.4 outcomes.
- Backfilled `Roadmap/June/` daily files for Jun 21–30 (stubs for gap days + real 06-26 + 06-27 + placeholders).
- Did NOT commit (Bucket C — Kira's push).

## Next Action
1. **Kira:** push the local stack (D2.5 cleanup `1f1801b` + D1 emails `08715e3` + unread-count/web-Places fix `7875b31` + this session's D2.1 commit once approved) — see HUMAN-TODO
2. **Kira:** walk through Expo Go on iPhone → file bug list to `Roadmap/June/2026-06-26.md` (D2.0); include the new EmployeeProfile trust card in the tap-through
3. **Kira:** create 3 seed accounts in Supabase Auth (Auto-Confirm ON)
4. **Kira:** paste Stripe keys into Render + configure webhook
5. **Claude:** D2.2 invoices (next runnable code domino) — in-app receipt + PDF via reportlab

## Security Gate
✅ passing. All migrations via service role; no destructive changes; RLS on every table; 2 pre-existing Supabase WARNs unchanged (job-photos public bucket listing + HIBP password leak protection — both tracked, not regressions). `credentials/` gitignored.

## Session End Signal
🟢 BUILD-READY — STATUS lie corrected, D2.4 unblocked. Next session can start D2.1 immediately without re-deriving context.

## Waiting On
Bucket B/C items in [[HUMAN-TODO]]. No autonomous loop is required for the build to advance — Claude can pick up D2.1 in any direction. The loop was previously hammering frozen-on-Kira because STATUS was lying about what was uncommitted; it now reflects real state.

---
*[[MAP]] · single source of truth for "what is true right now" · rewritten by [[ORCHESTRATOR]] each session*
