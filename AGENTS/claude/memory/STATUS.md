# STATUS — Current Project State

> Rewritten by Orchestrator at the end of every session. Single source of truth for right now.
> Rewritten 2026-07-14: honest re-baseline after a ~7-day slip on the tester chain (D4 never ran). July day files Jul 14–31 re-dated to match; Jet × Pulse design handoff filed into `design/`. Prior rewrite 2026-07-07.

## Active Project
swingby

## Repo Path
`/home/l3thal/agents/projects/swingby` (Linux). NOTE: prior STATUS + CLAUDE.md local-dev commands reference the old Windows path (`C:/Users/amrba/...`, `C:/Python314/python.exe`) — update CLAUDE.md Local Dev section when convenient.

## Last Updated
2026-07-14 — Roadmap re-plan session: STATUS re-baselined, Jul 14–31 day files re-dated (tester chain → Jul 15–19, store prep → Jul 20–24, legal/polish/submit → Jul 25–31), Jet × Pulse handoff moved to `design/handoff-jet-pulse/` with `design/tokens.md` + `MOTION.md` synced to the tokens already live in `mobile/src/theme/tokens.js`.

## Current Phase
**Phase 1 — BETA**, still gated on the D2.0/D3 human walkthrough. Domino truth (frontmatter verified 2026-07-14):
- ✅ D1 — Email sends (commit `08715e3`)
- ✅ D2 — Kill mock data
- 🟡 D2.1 — Employee trust card: code-complete since 2026-07-07, `in-progress`, awaits on-device verify
- ⬜ D2.0 / D2.2 / D2.3 / D2.4 / D2.5 — `pending`
- ⬜ D3 (Expo Go walkthrough) / D4 (friend tester) — `pending`. **D4 was calendared for Jul 7; it has not happened.**
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
- **D2.0/D3 walkthrough unlogged** — no recorded ground truth of the deployed app from a tester's seat.
- **Placeholders unset:** Sentry DSN, hCaptcha secret.
- **Latent:** `reviews.reviewee_type` CHECK lacks `'employee'` — D2.1 endpoint returns 0 reviews until a migration + review-target picker land (parked, separate domino).

## Blocked On (all Kira)
1. D2.0/D3 walkthrough (~1 hr) — the single gate holding D4 and the whole re-dated calendar
2. Rotate the leaked Google Maps key
3. GitHub security toggles + Dependabot major-bump triage (2 min)
4. Commit + push the 2026-07-14 re-plan (this STATUS, day files, `design/` filing)

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
1. **Kira (today, Jul 14):** catch-up gate day per `Roadmap/July/2026-07-14.md` — walkthrough + Maps key + GitHub toggles + D2.1 on-device verify
2. **Kira:** push the re-plan commit
3. **Claude:** D2.2 invoices polish per domino spec (code-runnable, no Kira blocker) once dispatch resumes
4. **Joint:** capture any Jul 10 walkthrough findings into D2.0/D3 logs before they evaporate

## Security Gate
✅ passing. No schema or endpoint changes this session (docs/roadmap only). Maps key rotation still outstanding (Kira). `credentials/` gitignored.

## Session End Signal
🟢 BUILD-READY — calendar and STATUS now match repo truth. Next session can dispatch D2.2 or hotfix walkthrough findings without re-deriving context.

## Waiting On
Kira's catch-up day (Jul 14 file). The re-dated calendar only holds if D2.0/D3 clears by Jul 15 morning — every later date keys off the D4 run on Jul 15.

---
*[[MAP]] · single source of truth for "what is true right now" · rewritten by [[ORCHESTRATOR]] each session*
