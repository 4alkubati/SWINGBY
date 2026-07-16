# STATUS — Current Project State

> Rewritten by Orchestrator at the end of every session. Single source of truth for right now.
> Rewritten 2026-07-14: honest re-baseline after a ~7-day slip on the tester chain (D4 never ran). July day files Jul 14–31 re-dated to match; Jet × Pulse design handoff filed into `design/`. Prior rewrite 2026-07-07.

## Active Project
swingby

## Repo Path
`/home/l3thal/agents/projects/swingby` (Linux). NOTE: prior STATUS + CLAUDE.md local-dev commands reference the old Windows path (`C:/Users/amrba/...`, `C:/Python314/python.exe`) — update CLAUDE.md Local Dev section when convenient.

## Last Updated
2026-07-16 (evening) — **Uber-flow audit complete + Phase UBER queued for tonight.** Full journey walked against prod: employee-create 409 (DB trigger collision — broken for every business), BookingDetails unreachable in normal nav (Pay button + client timeline trapped), no confirm-date UI anywhere in mobile. Extended flow verified green end-to-end once an employee exists (manual SQL insert). Kira decisions: confirm-date = handshake card in the chat thread; Home browse-first with Post-a-job at bottom; off-taxonomy → General (searchable). Kira has an ANDROID PHONE now — on-device verify happens right after each morning push. Telegram brief redesign PARKED — Kira is sending a folder + personal context first. Audit: `docs/qa-audit-2026-07-16-uber-flow.md`. Prior: **Phase CAT PUSHED + DEPLOYED + PROD SMOKE ALL PASS.** Kira approved push; committed `0ef7cd7` → Render autodeploy → `tools/e2e_smoke.py` vs `swingbyy-api.onrender.com`: **25/25 PASS first attempt**, incl. new checks (category normalized to "Cleaning", new post visible in business feed). Remaining: Kira on-device verify (lawncare feed = Landscaping+General only; gesture error gone) + laptop `git pull`. Prior: Phase CAT overnight loop COMPLETE (see Session End Signal). Category matching + taxonomy unification + RN fixes shipped to working tree, all local gates green, no push. Prior same-day: Morning-brief session: Telegram delivery FIXED + verified (bot @L3thallbot, 06:05 daily). LAPTOP RESCUE: week of unpushed Jul 9–12 work recovered via git bundle + merged (`d350295`) — full D2.0 walkthrough triage (4 bugs), Jul 11 Sentry fixes (UUID guard on /messages, Stripe price fail-fast, Sentry noise filter), Jul 10–12 polish sweep across 40 mobile screens. Backend pytest 23✅/3 skipped; 113 mobile files parse clean; pushed → Render redeploying. Prior rewrite 2026-07-14 (re-plan).

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
- **Google Maps key compromised** — leaked in public repo, placeholder committed; Kira must regenerate (open since Jul 1).
- **Emails land in spam** — new-domain reputation, DNS verified correct. Mitigations in HUMAN-TODO.
- **D2.0 triage bugs:** 🟢 quote posts to wrong category (bug #1 — lawncare saw cleaning/massage posts): **FIX CODED in Phase CAT** (working tree, READY-TO-PUSH) — awaits deploy + on-device verify; 🔴 match creates no Messages conversation — UUID-guard fix deployed 2026-07-15, needs on-device retest. D3 still needs its own logged run.
- **Placeholders unset:** Sentry DSN, hCaptcha secret.
- **Latent:** `reviews.reviewee_type` CHECK lacks `'employee'` — D2.1 endpoint returns 0 reviews until a migration + review-target picker land (parked, separate domino).

## Blocked On (all Kira)
1. D3 Expo Go walkthrough + D4 friend-tester run (D2.0 gate cleared 2026-07-15 — calendar keys off D4 now)
2. Rotate the leaked Google Maps key
3. GitHub security toggles + Dependabot major-bump triage (2 min)
4. Commit + push the 2026-07-14 re-plan + this session's brief/walkthrough updates

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
1. **Kira (Jul 15):** D3 Expo Go walkthrough + line up D4 friend tester (per re-dated calendar) · Maps key rotation · GitHub toggles · D2.1 on-device verify
2. **Kira (~10 min):** dump remaining D2.0 walkthrough findings into the domino log (only HEIC got filed)
3. **Kira:** push the re-plan + tonight's brief/walkthrough updates
4. **Claude:** D2.2 invoices polish per domino spec (code-runnable, no Kira blocker) once dispatch resumes

## Security Gate
✅ passing. No schema or endpoint changes this session (docs/roadmap only). Maps key rotation still outstanding (Kira). `credentials/` gitignored.

## Session End Signal
🌙 **PHASE-UBER QUEUED** (2026-07-16 evening) — new Tonight queue in PLAN.md from the full Uber-flow audit (`docs/qa-audit-2026-07-16-uber-flow.md`): 3 P0s (employee-create 409 broken in prod · BookingDetails unreachable · no confirm-date UI) + handshake-in-chat design, browse-first Home, General catch-all, docs cleanup. Prod re-verified today: standard smoke 25/25 PASS + extended flow (assign→confirm-date→Stripe checkout→events→complete→review) passes end-to-end once an employee exists. Prior state (Phase CAT): **PHASE-CAT-COMPLETE** · **PUSHED + DEPLOYED + SMOKE-GREEN** (2026-07-16 early AM: Kira approved, `0ef7cd7` pushed, Render deployed, prod smoke 25/25 PASS). Prior overnight state: Phase CAT overnight loop COMPLETE (Opus orchestrator → backend/mobile/qa/marketing agents). All local gates green, NO push made (Bucket C — Kira's morning call). Delivered:
- **CAT-1/2 backend** (`categories.py` new + `service_posts.py`/`businesses.py`/`conftest.py` + `test_service_posts.py`): canonical taxonomy, normalize-on-create, `ilike` on `?category=` (wildcard-escaped), business-feed auto-filter = own+RELATED+General via `.or_()`, degrades to unfiltered on any lookup failure. **Docker pytest: 35 passed / 3 skipped** (was 23/3 — +12 new), black clean, py_compile clean.
- **CAT-3/4 mobile**: single canonical `constants/categories.js` (8 entries, `landscaping` replaces broken `lawn`, +Handyman); CategoryScroll re-exports it; PostJob + BusinessSetup consume it. `GestureHandlerRootView` wraps App.js root; 5 files switched `SafeAreaView` → `react-native-safe-area-context`. **Babel: 115 files / 0 errors**; grep clean (no `'lawn'`, no RN `SafeAreaView`).
- **CAT-5 smoke prep**: `e2e_smoke.py` posts `"cleaning"` → expects `"Cleaning"` + new business-feed-visibility check. Edit-only (NOT run vs Render tonight).
- **CAT-6 regression**: pytest 35/3 · babel 115/0 · **flow graph 0 broken edges / 0 broken API**.
- **CAT-7 D2.2 invoices**: VERIFIED already code-complete (JSON + PDF endpoints auth-gated + registered; InvoiceScreen both roles w/ states; "View receipt" on BookingDetails + JobManagement; BusinessInvoices list). Only open item = on-device PDF-in-Safari render (Bucket B, needs Render + a completed booking). No rebuild — working code left intact.
- **CAT-8 D4 tester kit (draft)**: `Roadmap/dominoes/D4-tester-brief.md` + `D4-bug-capture-sheet.md`. Nothing sent.

One backend sub-agent crashed mid-run on a transient API error; resumed from transcript and finished clean (no retry-cap hit). No push/deploy/live-Supabase this session.

## Waiting On (all Kira)
1. ~~Approve push~~ ✅ DONE 2026-07-16 (`0ef7cd7`). ~~Render smoke~~ ✅ 25/25 PASS.
2. **On-device re-verify:** lawncare dashboard shows only Landscaping(+General) posts (bug #1 fixed) + gesture error gone after Expo Go pull.
3. **Laptop sync:** in Git Bash on laptop, `cd /c/Users/amrba/OneDrive/Desktop/AMR/10-SWINGBY/Swingby && git pull origin main` (reads work; if `index.lock`, pause OneDrive, delete lock, retry). Still outstanding: fix laptop push auth + move repo out of OneDrive.
4. D3 walkthrough + D4 tester run — every later calendar date keys off D4. Tester kit is drafted and waiting.

---
*[[MAP]] · single source of truth for "what is true right now" · rewritten by [[ORCHESTRATOR]] each session*
