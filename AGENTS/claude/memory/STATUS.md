# STATUS — Current Project State

> Rewritten by Orchestrator at the end of every session. Single source of truth for right now.
> Rewritten 2026-06-27 (D2.5 cleanup): stripped 9 stale frozen-on-Kira appends from runs 15–23. The 4 mobile fixes + CHECK bug they kept claiming were uncommitted are SHIPPED (commits `214fdb6`, `340e537`). The loop was lying.

## Active Project
swingby

## Repo Path
C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby

## Last Updated
2026-07-01 — Bucket C CLEARED: 12 commits pushed (D2.2/D2.3/D2.4 + audit fixes + hygiene + CI repair). Backend CI green for the first time ever. Render serving the new routes.

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
- **Google Maps key compromised.** The real Android key sat in plaintext in `mobile/app.json` in a PUBLIC repo. Placeholder now committed; Kira must regenerate the key in Google Cloud Console (HUMAN-TODO, blocking).
- **Emails land in spam despite correct DNS.** SPF+DKIM+DMARC all verified resolving; this is new-domain reputation, not configuration. Mitigations in HUMAN-TODO (postmaster tools, rua, tester "Not spam").
- **D2.0 walkthrough not done.** No live ground-truth on what the deployed app actually looks like to a tester. Waiting on Kira's iPhone via Expo Go. All 3 seed accounts now work.
- **Placeholders unset:** Sentry DSN, hCaptcha secret.

## What Got Fixed 2026-07-01
- Seed accounts verified in Supabase Auth (all 3, employee linked to Bob's Cleaning Co.); employee 403 on `/businesses/me` was a code bug — employees now resolve their employer's business (`is_employee: true` flag).
- Stripe keys in Render (Kira). DMARC TXT live (Kira).
- F1 `/payments/mine` + F2 disputes (router + table + RLS) — flow graph reports 0 broken API calls.
- Backend CI repaired: ruff+black conformance (lint had failed every push since Jun 26), test suite rewritten to current API (26 pass / 0 fail), stub env vars for the test job. `.gitattributes`, Dependabot, real README added.

## Blocked On
1. Kira's iPhone for D2.0 walkthrough audit (now fully unblocked — accounts + routes live)
2. Kira to rotate the leaked Google Maps key (public repo = compromised)
3. Kira: 2-min GitHub security toggles + Dependabot major-bump triage (HUMAN-TODO)

## Open Broadcasts
- 2026-07-06 — Notion added to the stack as a nudge layer (like Google Calendar): "SwingBy" DB, protocol in `AGENTS/claude/config/NOTION_SYNC.md`. First check found 2 stale rows (F1/F2 already shipped) + 1 date-vs-sequence risk (D4 due tomorrow, predecessors not done) — both in HUMAN-TODO.
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
1. **Kira:** rotate the Google Maps key (blocking, security)
2. **Kira:** D2.0 walkthrough on Expo Go iOS → bug list into the daily file; include employee login + Invoice + Plan card in the tap-through
3. **Kira:** GitHub security toggles (2 min) + close Dependabot major-bump PRs
4. **Claude:** smoke test against Render with the live seed accounts (`backend/scripts/smoke_e2e.py`), then D2.4 mobile polish per the domino, then D3
5. **Joint:** Obsidian vault linking pass (plan in `AGENTS/claude/deliverables/repo-audit-2026-07-01.md` §9)

## Security Gate
✅ passing. All migrations via service role; no destructive changes; RLS on every table; 2 pre-existing Supabase WARNs unchanged (job-photos public bucket listing + HIBP password leak protection — both tracked, not regressions). `credentials/` gitignored.

## Session End Signal
🟢 BUILD-READY — STATUS lie corrected, D2.4 unblocked. Next session can start D2.1 immediately without re-deriving context.

## Waiting On
Bucket B/C items in [[HUMAN-TODO]]. No autonomous loop is required for the build to advance — Claude can pick up D2.1 in any direction. The loop was previously hammering frozen-on-Kira because STATUS was lying about what was uncommitted; it now reflects real state.

---
*[[MAP]] · single source of truth for "what is true right now" · rewritten by [[ORCHESTRATOR]] each session*
