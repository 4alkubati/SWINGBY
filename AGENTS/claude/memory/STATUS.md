# STATUS — Current Project State

> Rewritten by Orchestrator at the end of every session. Single source of truth for right now.
> Rewritten 2026-07-14: honest re-baseline after a ~7-day slip on the tester chain (D4 never ran). July day files Jul 14–31 re-dated to match; Jet × Pulse design handoff filed into `design/`. Prior rewrite 2026-07-07.

## Active Project
swingby

## Repo Path
`/home/l3thal/agents/projects/swingby` (Linux). NOTE: prior STATUS + CLAUDE.md local-dev commands reference the old Windows path (`C:/Users/amrba/...`, `C:/Python314/python.exe`) — update CLAUDE.md Local Dev section when convenient.

## Last Updated
2026-07-17 (post-overnight close-out) — **Phase UBER COMPLETE + re-verified + READY-TO-PUSH.** The overnight loop (398502) shipped all 8 UBER tasks to the working tree and appended SESSION_LOG but never closed STATUS (it still read "QUEUED"). This session re-verified the output and closed memory: read every produced backend + mobile file directly, re-ran the flow graph (**0 broken edges**, new MyJobs→BookingDetails + ActiveBooking→BookingDetails edges present), py_compiled all 8 changed backend files (clean), and confirmed i18n EN/FR/AR keys (6/6) + ConfirmDateCard wired into all 3 host screens + the first-ever mobile `PATCH /confirm-date` caller. **Verification limit (honest):** docker pytest + babel could NOT be re-run on this desktop box — no docker access, no pip/venv, mobile `node_modules` absent (exactly audit item #9). Those gates were green in the overnight run (pytest 36/3, babel 115/0) against a byte-identical tree; the real runtime gate is the morning e2e_smoke vs Render after Kira pushes. **Nothing committed (Bucket C = Kira's push).** Prior: **Uber-flow audit** (`docs/qa-audit-2026-07-16-uber-flow.md`) surfaced the 3 P0s; Kira decisions: confirm-date = handshake card in the chat thread; Home browse-first with Post-a-job at bottom; off-taxonomy → General (searchable). Kira has an ANDROID PHONE now — on-device verify right after each morning push. Telegram brief redesign PARKED — Kira is sending a folder + personal context first. Prior: **Phase CAT PUSHED + DEPLOYED + PROD SMOKE ALL PASS.** Kira approved push; committed `0ef7cd7` → Render autodeploy → `tools/e2e_smoke.py` vs `swingbyy-api.onrender.com`: **25/25 PASS first attempt**, incl. new checks (category normalized to "Cleaning", new post visible in business feed). Remaining: Kira on-device verify (lawncare feed = Landscaping+General only; gesture error gone) + laptop `git pull`. Prior: Phase CAT overnight loop COMPLETE (see Session End Signal). Category matching + taxonomy unification + RN fixes shipped to working tree, all local gates green, no push. Prior same-day: Morning-brief session: Telegram delivery FIXED + verified (bot @L3thallbot, 06:05 daily). LAPTOP RESCUE: week of unpushed Jul 9–12 work recovered via git bundle + merged (`d350295`) — full D2.0 walkthrough triage (4 bugs), Jul 11 Sentry fixes (UUID guard on /messages, Stripe price fail-fast, Sentry noise filter), Jul 10–12 polish sweep across 40 mobile screens. Backend pytest 23✅/3 skipped; 113 mobile files parse clean; pushed → Render redeploying. Prior rewrite 2026-07-14 (re-plan).

## Current Phase
**Phase 1 — BETA**, gate cleared: D2.0 walkthrough confirmed done (Kira, 2026-07-15 — retro-logged). Domino truth:
- ✅ D1 — Email sends (commit `08715e3`)
- ✅ D2 — Kill mock data
- ✅ D2.0 — Live walkthrough: done ~Jul 9–11 per Kira (evidence `70d165a`, `9575fd3`); findings beyond HEIC fix still in Kira's head (HUMAN-TODO capture item)
- 🟡 D2.1 — Employee trust card: code-complete since 2026-07-07, `in-progress`, awaits on-device verify
- ⬜ D2.2 / D2.3 / D2.4 / D2.5 — `pending`
- ⬜ D3 (Expo Go walkthrough) / D4 (friend tester) — `pending`, now UNBLOCKED. **D4 was calendared for Jul 7; it has not happened.**
- ⏸ D5 — `deferred`

Signal worth noting: commits `70d165a` "pre-engine baseline" (Jul 9) and `9575fd3` "fix(uploads): accept HEIC/HEIF — iPhone default photo format" (Jul 10) imply real-device iPhone testing started around Jul 10, but no session log, domino log entry, or day-file checkbox recorded it. If a partial walkthrough happened, its findings live only in Kira's head — capture them into D2.0/D3 `📖 Log`.

## Slip Accounting (why the re-plan)
- Calendar said by Jul 13: two friend testers completed bookings, majors fixed, 10 outreach messages sent, feedback form live. None checked off.
- Actual: chain stalled at the same human gate as Jul 7 (D2.0 walkthrough). Last commit Jul 10, last session log Jul 7.
- Re-plan keeps the July win condition (store-ready build, Stripe live, submit by Jul 31) by compressing W3/W4 and merging light ops days. See `Roadmap/July/README.md` re-plan note.

## What's Working (deployed surface)
- **Backend (LIVE on Render `swingbyy-api.onrender.com`):** 65 routes incl. `/employees/{id}/profile`, `/messages/unread-count`, unified `/messages/threads` (pre-booking quote chat), `/interests/mine`, uploads (now HEIC/HEIF), booking events/photos, Stripe checkout + webhook.
- **Database:** Supabase 10 tables + `booking_events` + `booking_photos` + `messages_interest_threads` migration applied. RLS on every table. 5 lifecycle email triggers.
- **Email:** Resend wired, branded magic link from `team@swingbyy.com`.
- **Mobile:** Jet × Pulse repolish tokens live in `theme/tokens.js` (textTertiary, accentSoft, borderAccent, mapBg stops, accentGlow/card shadows). Business-flow session (Jul 3) shipped: unified inbox, quote-with-note chat, dashboard real earnings + sparkline, invoices screens, needs-attention chips.
- **QA:** `backend/scripts/smoke_e2e.py` + `tools/e2e_smoke.py` booking-loop smoke; flow graph reports 0 broken edges.

## What's Broken (real blockers)
- **App must survive Kira's own 15-min run** — he hits an error after 2–5 min; Jul 15 screenshots traced to the STALE LAPTOP build (fixed in main). Needs one clean self-run from fresh main before D4 tester outreach resumes.
- ~~Google Maps key compromised~~ ✅ CLOSED 2026-07-17 — key rotated + repo made private (Kira).
- **Emails land in spam** — new-domain reputation, DNS verified correct. Mitigations in HUMAN-TODO.
- **D2.0 triage bugs:** 🟢 quote posts to wrong category (bug #1 — lawncare saw cleaning/massage posts): **FIX CODED in Phase CAT** (working tree, READY-TO-PUSH) — awaits deploy + on-device verify; 🔴 match creates no Messages conversation — UUID-guard fix deployed 2026-07-15, needs on-device retest. D3 still needs its own logged run.
- **Placeholders unset:** Sentry DSN, hCaptcha secret.
- **Latent:** `reviews.reviewee_type` CHECK lacks `'employee'` — D2.1 endpoint returns 0 reviews until a migration + review-target picker land (parked, separate domino).

## Blocked On (all Kira)
1. **One clean 15-min self-run from fresh main on the Android phone** — gates D4; laptop copy is stale, don't test from it
2. Android on-device verify of UBER + CAT fixes (~10 min, itemized in HUMAN-TODO)
3. GitHub security toggles + Dependabot major-bump triage (2 min)
4. Product decision: ASAP-vs-required for confirm-date

2026-07-17 (Claude session): Phase UBER verified on prod — smoke 25/25 + targeted UBER test ALL PASS; fixed `booking_events` CHECK constraint missing `'date_confirmed'` (Supabase migration applied, re-verified). Maps key rotated + repo private (Kira) — H1 closed. July calendar populated in Google Calendar (AM day-plans Jul 17–31 + nightly 21:00 loop reminder).

## Open Broadcasts
- 2026-07-14 — July calendar re-dated; Jet × Pulse handoff filed into `design/handoff-jet-pulse/`; design token docs now match `tokens.js`
- 2026-07-06 — Notion nudge layer live (`AGENTS/claude/config/NOTION_SYNC.md`); Notion dates now lag the re-plan — flag rows when next synced
- 2026-06-27 — D2.4 monetization locked: customer 10% + business membership ($30 solo / $80 team), gate on Accept

## Last Agent Run
**2026-07-14 — Roadmap re-plan + design filing (inline, Claude Sonnet 5):**
- Filed `App design polish tips/design_handoff_swingby_polish/` → `design/handoff-jet-pulse/`; synced `design/tokens.md` (10 color tokens, 2 shadows, Jet × Pulse rules section) + `design/MOTION.md` (Live Pulse spec) to match code.
- Cross-checked calendar vs dominoes vs git: found the 7-day slip, re-dated Jul 14–31 day files, annotated slipped Jul 7–13 files, updated July README.
- Rewrote this STATUS. Did NOT commit (Bucket C — Kira's push).

## Next Action
1. **Kira:** 15-min self-run from FRESH main on the Android phone (not the laptop copy) — if any error appears, screenshot → brain/inbox, the loop fixes it that night. This gates D4.
2. **Kira (~10 min):** Android on-device verify of UBER + CAT fixes (itemized in HUMAN-TODO)
3. **Kira (1 line):** ASAP-vs-required decision for confirm-date
4. **Claude (tonight):** fix whatever the self-run surfaces; if nothing, D2.2 invoices polish per domino spec

## Security Gate
✅ passing. No schema or endpoint changes this session (docs/roadmap only). Maps key rotation still outstanding (Kira). `credentials/` gitignored.

## Session End Signal
✅ **ALL-TASKS-COMPLETE · PHASE-UBER-COMPLETE · READY-TO-PUSH** (2026-07-17 close-out) — the Tonight queue (UBER-1..8) is fully done in the working tree, re-verified this session (flow graph 0 broken · py_compile clean on all 8 changed backend files · i18n 6/6 EN/FR/AR · ConfirmDateCard wired into 3 hosts · first mobile confirm-date PATCH caller). Overnight gates (pytest 36/3, babel 115/0) not re-runnable on this box — see Last Updated. **Uncommitted, 20 modified + 2 new + KIRA.md deleted.** Everything remaining is Kira-gated (Bucket C push → Bucket B Android on-device verify), already itemized in HUMAN-TODO 2026-07-17. No further autonomous build queued.
Prior signal 🌙 **PHASE-UBER QUEUED** (2026-07-16 evening) — Tonight queue in PLAN.md from the full Uber-flow audit (`docs/qa-audit-2026-07-16-uber-flow.md`): 3 P0s (employee-create 409 broken in prod · BookingDetails unreachable · no confirm-date UI) + handshake-in-chat design, browse-first Home, General catch-all, docs cleanup. Prod re-verified today: standard smoke 25/25 PASS + extended flow (assign→confirm-date→Stripe checkout→events→complete→review) passes end-to-end once an employee exists. Prior state (Phase CAT): **PHASE-CAT-COMPLETE** · **PUSHED + DEPLOYED + SMOKE-GREEN** (2026-07-16 early AM: Kira approved, `0ef7cd7` pushed, Render deployed, prod smoke 25/25 PASS). Prior overnight state: Phase CAT overnight loop COMPLETE (Opus orchestrator → backend/mobile/qa/marketing agents). All local gates green, NO push made (Bucket C — Kira's morning call). Delivered:
- **CAT-1/2 backend** (`categories.py` new + `service_posts.py`/`businesses.py`/`conftest.py` + `test_service_posts.py`): canonical taxonomy, normalize-on-create, `ilike` on `?category=` (wildcard-escaped), business-feed auto-filter = own+RELATED+General via `.or_()`, degrades to unfiltered on any lookup failure. **Docker pytest: 35 passed / 3 skipped** (was 23/3 — +12 new), black clean, py_compile clean.
- **CAT-3/4 mobile**: single canonical `constants/categories.js` (8 entries, `landscaping` replaces broken `lawn`, +Handyman); CategoryScroll re-exports it; PostJob + BusinessSetup consume it. `GestureHandlerRootView` wraps App.js root; 5 files switched `SafeAreaView` → `react-native-safe-area-context`. **Babel: 115 files / 0 errors**; grep clean (no `'lawn'`, no RN `SafeAreaView`).
- **CAT-5 smoke prep**: `e2e_smoke.py` posts `"cleaning"` → expects `"Cleaning"` + new business-feed-visibility check. Edit-only (NOT run vs Render tonight).
- **CAT-6 regression**: pytest 35/3 · babel 115/0 · **flow graph 0 broken edges / 0 broken API**.
- **CAT-7 D2.2 invoices**: VERIFIED already code-complete (JSON + PDF endpoints auth-gated + registered; InvoiceScreen both roles w/ states; "View receipt" on BookingDetails + JobManagement; BusinessInvoices list). Only open item = on-device PDF-in-Safari render (Bucket B, needs Render + a completed booking). No rebuild — working code left intact.
- **CAT-8 D4 tester kit (draft)**: `Roadmap/dominoes/D4-tester-brief.md` + `D4-bug-capture-sheet.md`. Nothing sent.

One backend sub-agent crashed mid-run on a transient API error; resumed from transcript and finished clean (no retry-cap hit). No push/deploy/live-Supabase this session.

## Waiting On (all Kira) — full itemized list in HUMAN-TODO "🌅 This morning (2026-07-17)"
0. **(Bucket C) Approve + push Phase UBER** — 20 modified + 2 new (+ KIRA.md deletion). Then (Bucket B) `python3 tools/e2e_smoke.py https://swingbyy-api.onrender.com` ALL PASS → Android on-device: add employee (was 409), open BookingDetails from My Jobs, accept a proposed time from the chat handshake card, see date_confirmed on timeline, browse-first Home, off-taxonomy post → General.
0b. **(Product decision) ASAP-vs-required for confirm-date** — UBER ships the handshake but keeps confirmation optional; Kira's call.
1. ~~Approve CAT push~~ ✅ DONE 2026-07-16 (`0ef7cd7`). ~~Render smoke~~ ✅ 25/25 PASS.
2. **On-device re-verify (CAT):** lawncare dashboard shows only Landscaping(+General) posts (bug #1 fixed) + gesture error gone after Expo Go pull.
3. **Laptop sync:** in Git Bash on laptop, `cd /c/Users/amrba/OneDrive/Desktop/AMR/10-SWINGBY/Swingby && git pull origin main` (reads work; if `index.lock`, pause OneDrive, delete lock, retry). Still outstanding: fix laptop push auth + move repo out of OneDrive.
4. D3 walkthrough + D4 tester run — every later calendar date keys off D4. Tester kit is drafted and waiting.

---
*[[MAP]] · single source of truth for "what is true right now" · rewritten by [[ORCHESTRATOR]] each session*
