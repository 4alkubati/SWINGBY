# HUMAN-TODO — what's waiting on Kira

> The loop parks here anything only a human can do, and keeps working on everything else. Surfaced in the morning brief. Each item has the exact action.
> Cleaned 2026-07-01 (post-audit execution): Bucket C push DONE (12 commits on `main` through the CI fix), seed accounts DONE, Stripe keys DONE, DMARC DONE. Added GitHub security toggles + Dependabot triage.

## 🌅 This morning (2026-07-17) — Phase UBER overnight output

If the loop wrote READY-TO-PUSH to STATUS.md:

- [x] ~~(Bucket C — approve + push)~~ ✅ DONE — `f6a4a9d` pushed, Render deployed.
- [x] ~~(Bucket B — smoke after deploy)~~ ✅ DONE 2026-07-17 (Claude): prod smoke 25/25 PASS **+ targeted UBER test ALL PASS** (employee-create 200, assign→confirm-date→in_progress, `date_confirmed` on timeline, off-taxonomy→General). Found + fixed one leftover: `booking_events` CHECK constraint lacked `'date_confirmed'` — migration `booking_events_allow_date_confirmed` applied to Supabase, re-verified green.
- [x] ~~(Bucket C — push)~~ ✅ DONE 2026-07-17 late (Claude): pushed with the prod-outage fix; Render deployed; dashboard endpoints verified 200.

## 🌅 This morning (2026-07-18)

- [ ] **(Bucket B — verify the fixes, ~10 min)** On the phone (laptop already pulled main; run `cd mobile && cp .env.example .env` if .env missing, then `npx expo start --clear`): open your lawn booking chat → the handshake card now shows real text ("Proposer un horaire" on your French phone). Propose times as client → approve from the business account. Also confirm the business dashboard loads.
- [ ] **(Judge the new brief, 1 line back)** The 06:05 brief arrives in the new friendly voice with phase + health check. Say what reads clanky.
- [ ] **(Start the design session)** `tmux new -s swingby` → `cd ~/agents/projects/swingby && claude` → say "go on the design spec". The 31-screen atlas is filed and ready.
- [ ] **(Email workflows)** Drop the email files into brain/inbox; bring an OpenAI API key if you want GPT in the n8n flow (or we use Claude).
- [ ] **(Bucket B — Android on-device, ~10 min)** Add an employee (was 409-broken), open BookingDetails from My Jobs, **propose a time from the client chat → switch to the business account and approve it**, see it on the timeline, Home opens browse-first, post an off-taxonomy job → lands in General. **Use a FRESH pull of main — NOT the laptop copy** (the Jul 15 screenshots in brain/inbox are all stale-laptop bugs already fixed in main).
- [ ] **(Product decision — ASAP vs required)** Should a booking be completable with NO confirmed date? Options: require confirmation always / keep optional / require but add an "ASAP" quick-confirm. Tonight ships the handshake UI but keeps it optional pending your call.
- [x] ~~(Telegram debrief redesign)~~ ✅ DONE 2026-07-17 — rebuilt around `brain/KIRA.md` (folder is on the server): decisions pulled to the top of the action message, task sub-steps included (no more mid-sentence cut-offs), repo jargon tags stripped, raw stack traces never shown. Tomorrow's 06:05 brief is the first with the new voice — say if it still reads clanky.

Done earlier (2026-07-16 early AM): Phase CAT pushed (`0ef7cd7`), Render deployed, prod smoke 25/25 PASS.
- [ ] **(Bucket B — still open from CAT)** On-device: lawncare dashboard shows only Landscaping(+General) posts; gesture-handler error gone. (Laptop copy is stale — the VirtualizedList console error you screenshotted lives there, not in main.)
- [ ] **(Bucket B — D2.2 PDF, optional)** Once a sandbox booking is completed on Render: open a completed booking → "View receipt" → "Download PDF" → confirm the PDF opens in iOS Safari with all fields. (Code is done; this is the only unverified piece.)
- [ ] **(D4 tester kit is drafted)** `Roadmap/dominoes/D4-tester-brief.md` + `D4-bug-capture-sheet.md` are ready — fill the `{{EXPO_LINK}}` placeholder when you line up a tester.

## ⛔ Blocking (loop stuck until done)

- [ ] **(App must survive YOUR 15-min run before any tester)** Kira reports an error after 2–5 min of use — but the Jul 15 screenshots (brain/inbox IMG_1399–1401) are all from the **stale laptop build** (OneDrive paths in the call stack; VirtualizedLists error + wrong-category feed are both already fixed in main). D4 tester outreach is PAUSED until: (1) run the app from a **fresh pull of main** on the Android phone, (2) 15-min self-walkthrough survives clean, (3) if any error still appears, screenshot it → `brain/inbox/` and the loop fixes it that night.

Done 2026-07-17: ~~rotate the Google Maps key~~ ✅ key rotated + **repo is now PRIVATE** (per Kira). H1 closed.

## 🔑 Optional / when convenient

- [ ] **(D2.0 retest, ~15 min on iPhone)** Full walkthrough triage recovered from the laptop (4 bugs, `Roadmap/July/2026-07-09.md`). Retest the two open ones against Render: (1) 🔴 quote under Plumbing lands in Lawncare feed — if still broken this is the top code fix; (2) 🔴 match → conversation appears in Messages — backend UUID-guard fix deployed 2026-07-15, may already be resolved. (🟢 My Jobs card offset can wait.)

- [ ] **(Notion — D4 date vs. sequence)** Notion's "SwingBy" DB has **D4 — Friend/known-trade end-to-end run** due **2026-07-07**, but D2.0 (live walkthrough) and D3 (Expo Go walkthrough) — both prerequisites per `Roadmap/DOMINOES.md` — aren't done. Either push D4's due date in Notion or accept it slips.
- [ ] **(Notion — stale rows, manual flip needed)** Notion's "SwingBy" DB still shows **F1 `/payments/mine`** and **F2 disputes** as "Not started," but STATUS.md confirms both shipped 2026-07-01. This DB doesn't auto-sync from git yet (see `AGENTS/claude/config/NOTION_SYNC.md`) — flip both rows to Done in Notion, or say the word and a git→Notion sync gets wired next.

- [ ] **(GitHub — 2 minutes of clicking, agent was permission-blocked)** Repo Settings → *Code security and analysis* → enable **Dependabot alerts**, **Secret scanning**, and **Push protection** (all free on public repos). Optional: Settings → Branches → protect `main` from force-push/deletion.
- [ ] **(GitHub — Dependabot triage)** Dependabot opened its first PRs, including **major** bumps (`@react-navigation/native` 6→7, `async-storage` 2→3, `pytest` 7→9). Do NOT merge the majors blindly — navigation v7 is a breaking migration. Merge patch/minor, close majors until post-beta.
- [ ] **(Email deliverability — DMARC is done, spam persists = domain reputation)** DNS is verified correct (SPF+DKIM+DMARC all present). Actions that actually move inbox placement:
  1. Every beta tester: mark "Not spam" + add `team@swingbyy.com` to contacts (fastest fix).
  2. Upgrade DMARC to `v=DMARC1; p=none; rua=mailto:dmarc@swingbyy.com`, then `p=quarantine` after a clean week.
  3. Register https://postmaster.google.com for swingbyy.com.
  4. Run one email through mail-tester.com — fix anything under 9/10.
- [x] ~~(Repo visibility decision)~~ ✅ DONE 2026-07-17 — repo made **private** (per Kira). Test creds + infra IDs no longer world-readable; rotating the `.dev` test creds is now optional hygiene.
- [ ] **(D2.4 confirm — default if silent)** Beta posture for business subscription. Current default: **track-only during beta** (every business stays `trialing`, no Stripe charge until public launch). If you'd rather flip Stripe Checkout on during beta so testers actually subscribe with a test card — say so and we'll wire it in D2.4 step 1.
- [ ] **Install impeccable design skill** (free). In Git Bash from repo root: `npx impeccable@latest` OR download the Claude Code ZIP from impeccable.style → extract so it lands at `Swingby/.claude/skills/impeccable/`. Then the design-agent uses `/impeccable shape|audit|critique|polish`. Skill pointer already wired: `AGENTS/claude/skills/impeccable-design.md`.
- [ ] **Qwen 3 overnight wiring (deferred 2026-06-27)** — local Qwen drains memory. Strategy locked: fallback on Anthropic limit hit (Claude default, Qwen takes the cycle that would otherwise sleep 15 min). Revisit when memory situation is sorted — smaller local Qwen variant, OpenRouter, or DashScope.

## ⏸️ Deferred — DO NOT spend money until the mobile app is finished + testers lined up

- Apple Developer ($99/yr), Google Play ($25), EAS/TestFlight dev build. Test free on your own phone first via `npx expo run:android` or Expo Go (which is what D2.0/D3 use).

## ✅ Done

- ✅ **Telegram morning brief LIVE (2026-07-14 evening)** — fresh bot @L3thallbot wired, chat_id fixed (was the bot's own id), test brief delivered to Kira's phone (execution 5). Fires daily 06:05 America/Edmonton.
- ✅ **D2.0 walkthrough (per Kira, done ~Jul 9–11)** — confirmed 2026-07-15; iPhone real-device pass produced the HEIC/HEIF fix (`9575fd3`). Findings capture parked in Optional above.
- ✅ **Bucket C push (2026-07-01)** — 12 commits landed: D2.2 invoices, D2.3 off-platform pay, D2.4 subscriptions, F1 `/payments/mine`, F2 disputes, hygiene sweep, lint conformance, test-suite repair, CI env fix, `.gitattributes`, Dependabot, real README. Render redeployed — new routes verified live.
- ✅ **Backend CI green (2026-07-01)** — first passing run ever; lint had failed on every push since it was added.
- ✅ **Seed accounts** — all 3 exist in Supabase Auth with profiles + employee linked to Bob's Cleaning Co. Employee 403 was a code bug (`/businesses/me` owner-only), fixed.
- ✅ **Stripe keys in Render** (per Kira 2026-07-01)
- ✅ **DMARC TXT record** on swingbyy.com (verified `v=DMARC1; p=none;` resolving)
- ✅ 4 mobile + qa fixes (JobManagement dead button, BookingDetails Pay gate + paymentPill schema, smoke 401 hint) — commit `214fdb6`
- ✅ CHECK constraint extended to allow `'refunded'` on `bookings.payment_status` — commit `340e537`
- ✅ D1 — 5 lifecycle transactional emails wired — commit `08715e3`
- ✅ Trust layer (events + photos) + Stripe sandbox scaffold — commit `554453b`
- ✅ Mobile bucket reorg (9 buckets, zero flat top-level) — commit `938799e`
- ✅ Supabase: Confirm email ON + URL config
- ✅ Render: RESEND_API_KEY + RESEND_FROM_EMAIL
- ✅ Branded email delivers (magic link from team@swingbyy.com)
- ✅ D2.4 NEEDS-KIRA × 3 answered (monetization model, tier prices, gate)

---
*[[MAP]] · filled by [[LOOP]] · surfaced in the [[_AUTOMATION]] morning brief*
