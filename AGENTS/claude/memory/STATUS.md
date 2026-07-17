# STATUS — Current Project State

> Rewritten by Orchestrator at the end of every session. Single source of truth for right now.
> Rewritten 2026-07-17 overnight (Fable orchestrator — Kira's "you run and decide" session). Prior rewrite 2026-07-17 late (outage + i18n session).

## Active Project
swingby

## Repo Path
`/home/l3thal/agents/projects/swingby` (Linux)

## Morning Brief

### Backend
- No backend code changed tonight (UI + ops + audit session). Prod re-verified green: doctor 7/7 PASS, health 200, all four dashboard endpoints 200 as a real business login.
- Supabase checked directly: both Jul 17 migrations confirmed applied (`booking_events_allow_date_confirmed`, `date_handshake_proposer_tracking`) — the handshake's DB side is fully live. Security advisors: no missing RLS; 3 known WARNs tracked (HIBP toggle for Kira, disputes-fn search_path, job-photos bucket listing).
- Nice signal from Kira's screenshots: the booking-confirmed email landed in the **Inbox**, not spam (from hello@swingbyy.com).

### Frontend
- FIXED: PostJob wizard step tabs no longer render under the status-bar clock (SafeArea insets, same idiom as sibling screens).
- FIXED: Chat header now shows the other party's real name even when the opening screen forgets to pass it — self-heals from the booking payload. All 8 existing callers audited (all already pass the name).
- **31-screen design execution spec is written**: `AGENTS/claude/deliverables/design-exec-spec-2026-07-18.md` — 63 items (2 P0 · 26 P1 · 35 P2) with a wave-ordered implementation plan. The 2 P0s: employee reviews show a placeholder (needs the `reviewee_type` migration) and Referral stats are hardcoded zeros (no backend). One product call needed before dispatch: the "Job Management" mock is actually Dashboard's lead feed (spec entry #26).
- QA regression 5/5 PASS (babel 115/0 via docker · flow graph 0 broken · all grep gates).

### Recap
- **Memory verified AND tested end-to-end** (Kira's ask): git clean+pushed at session start, prod endpoints live-checked, n8n brief confirmed active (06:05 Edmonton, container up), doctor hooks confirmed wired, migrations confirmed in Supabase, flow graph re-run, all 9 inbox screenshots triaged (all were evidence of already-fixed or already-queued bugs), 2 stale auto-memories corrected, 10 stale issue-tracker rows deleted after grep-proofing each against code (June CRITICAL section is now empty).
- Message bus drained: 2 stale June items archived with resolutions; tonight's 3 REQUESTs dispatched and RESOLVED with review notes.
- run-overnight.sh livelock FIXED (flock lockfile + WAITING-ON-HUMAN break + fast-fail backoff) — the 397885 all-night respawn can't happen again.
- "Never started" ledger sent to Kira's Telegram (2 messages, delivered): every discussed-but-unbuilt item, with the 4 decisions pulled to the top (also in HUMAN-TODO → Decisions batch).
- **Nothing committed (Bucket C = Kira's push).** Working tree: 2 mobile fixes, design spec, run-overnight fix, .gitignore line, memory files.

## Last Updated
2026-07-17 overnight (Fable orchestrator): full company audit + Phase POLISH-SPEC executed same-session. Verified every memory claim against reality (prod, Supabase, n8n, hooks, git, inbox); drained the bus; dispatched design-agent (31-screen exec spec), mobile-agent (wizard SafeArea + chat header), qa-agent (5/5 regression) with full bus comms; fixed the overnight-runner livelock; sent the never-started ledger to Telegram; corrected stale trackers/memories (incl. domino truth below — D2.2/D2.3/D2.4 shipped Jul 1 but still showed pending). Prior: 2026-07-17 late (live w/ Kira) — prod outage fixed (PostgREST embed ambiguity, `77720d7`), i18n resurrected in all 3 locales (`16521a8`), morning brief restyled + re-armed, session doctor live, 31-screen mock atlas filed. Prior: Phase UBER complete + prod-verified (employee-create 409 fix, BookingDetails reachable, confirm-date handshake now two-way per Kira's correction `9f1280d`, browse-first Home, General catch-all). Older history: SESSION_LOG + archive.

## Current Phase
**Phase 1 — BETA.** Domino truth (corrected tonight — D2.5's exact job):
- ✅ D1 — Email sends (`08715e3`); lifecycle emails landing in Inbox as of Jul 16
- ✅ D2 — Kill mock data
- ✅ D2.0 — Live walkthrough (Kira, ~Jul 9–11; findings beyond HEIC in Kira's head — capture item stands)
- 🟡 D2.1 — Employee trust card: code-complete; NOTE the D2.1 review endpoint stays empty until the employee-review migration lands (also design-spec P0)
- 🟡 D2.2 — Invoices: shipped Jul 1 (`0ef7cd7` re-audit CAT-7 confirmed code-complete); only on-device PDF check open
- ✅ D2.3 — Off-platform pay: shipped Jul 1
- 🟡 D2.4 — Business subscription: shipped Jul 1; beta posture decision open (default track-only)
- 🔄 D2.5 — Status cleanup: largely executed tonight (this rewrite + tracker re-verify); close after Kira reads
- ⬜ D3 (Expo Go walkthrough) / D4 (friend tester) — gated on Kira's clean 15-min self-run
- ⏸ D5 — deferred

## What's Working (deployed surface)
- **Backend (LIVE on Render `swingbyy-api.onrender.com`):** 65+ routes incl. two-way confirm-date handshake (`/propose-dates` + `/confirm-date`), unified `/messages/threads`, uploads (HEIC/HEIF), booking events/photos + `date_confirmed` timeline, Stripe checkout + webhook, `/businesses/me/analytics`. Sentry alerting works (it caught the Jul 17 outage in real time).
- **Database:** Supabase 10 tables + booking_events/photos + disputes; RLS everywhere; 15 migrations incl. both Jul 17 handshake migrations. 5 lifecycle email triggers.
- **Mobile:** i18n live in EN/fr-CA/AR (flat-key fix `16521a8`); handshake ConfirmDateCard two-way; browse-first Home; BookingDetails reachable; wizard SafeArea + chat-header identity fixed tonight (working tree).
- **Automation:** 06:05 Telegram brief (verified active tonight); post-session doctor (7/7 PASS); overnight runner now livelock-proof (working tree).
- **QA:** e2e_smoke covers post→quote→accept→handshake→complete; flow graph 0 broken edges.

## What's Broken (real blockers)
- **App must survive Kira's own 15-min run** — the three root causes of the "stuck after 2–5 min" reports are all fixed and deployed (embed outage, missing mobile/.env, dead i18n). One clean on-device run from fresh main is the remaining gate before D4.
- **Emails can still land in spam for new recipients** — domain reputation (though Jul 16's booking email hit Kira's Inbox). Mitigations in HUMAN-TODO.
- **Employee reviews dead-end** — `reviews.reviewee_type` CHECK lacks `'employee'` + no review-target picker (design-spec P0; needs migration + UI; ship together with code per the Jul 17 rule).
- **Placeholders unset:** mobile Sentry DSN (backend Sentry IS live), hCaptcha secret.

## Blocked On (all Kira)
1. **One clean 15-min self-run from fresh main on the Android phone** — gates D4.
2. Handshake on-device verify (~10 min, itemized in HUMAN-TODO 2026-07-18).
3. **Decisions batch (4 one-liners, sent to Telegram + HUMAN-TODO):** confirm-date policy · Referral build-or-hide · D2.4 beta billing posture · invite card drop-or-build. Plus spec #26 JobManagement product call before that entry is built.
4. GitHub Dependabot toggle + majors triage (2 min).

## Open Broadcasts
- 2026-07-17 — Issue tracker re-baselined against code (10 stale rows deleted, CRITICAL empty, L13–L15 added); message bus drained to OPEN-only.
- 2026-07-14 — July calendar re-dated; Jet × Pulse handoff filed into `design/handoff-jet-pulse/`.
- 2026-07-06 — Notion nudge layer live; Notion dates lag the re-plan — flag rows when next synced.
- 2026-06-27 — D2.4 monetization locked: customer 10% + business membership ($30 solo / $80 team), gate on Accept.

## Last Agent Run
**2026-07-17 overnight — Phase POLISH-SPEC (Fable orchestrator; design-agent + mobile-agent Sonnet, qa-agent Haiku):** all 3 bus REQUESTs dispatched, executed, reviewed (diffs read directly), RESOLVED. Output in working tree, nothing committed (Bucket C).

## Next Action
1. **Kira (morning):** read this + the Telegram ledger → approve + push the working tree → 15-min self-run from fresh main → answer the 4-decision batch (+ spec #26 call).
2. **Claude (next session):** dispatch design-spec Wave 1 (shared components NearbyCard/TextField/TrendDelta + client-side P1s); employee-review migration + picker once Kira confirms; JobManagement entry only after the #26 call.
3. **Then:** D3 walkthrough → D4 tester (kit drafted, outreach stays PAUSED until the 15-min run is clean).

## Security Gate
✅ passing — no endpoints or schema changed tonight; advisors show no missing RLS; no secrets in the tree (grep-checked as part of review); `.env`s gitignored.

## Session End Signal
✅ **AUDIT-CLEAN · SPEC-READY · FIXES-GREEN · WAITING-ON-HUMAN** (2026-07-17 overnight) — memory verified+tested, bus drained, POLISH-SPEC complete (spec + 2 UI fixes + QA 5/5), overnight runner livelock-proofed, never-started ledger on Kira's phone. Working tree uncommitted = Kira's morning push. Everything actionable left is the decisions batch + on-device verifies (HUMAN-TODO). No further autonomous build queued tonight.
Prior signal ✅ **PROD-GREEN · HANDSHAKE UNBLOCKED · DESIGN ATLAS FILED** (2026-07-17 late) — prod outage fixed + deployed, i18n fixed in 3 languages, brief restyled, doctor live, atlas filed; everything pushed (`10738c7` = HEAD).

---
*[[MAP]] · single source of truth for "what is true right now" · rewritten by [[ORCHESTRATOR]] each session*
