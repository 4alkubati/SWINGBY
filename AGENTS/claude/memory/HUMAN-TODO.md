# HUMAN-TODO — what's waiting on Kira

> The loop parks here anything only a human can do, and keeps working on everything else. Surfaced in the morning brief. Each item has the exact action.
> Cleaned 2026-07-01 (post-audit execution): Bucket C push DONE (12 commits on `main` through the CI fix), seed accounts DONE, Stripe keys DONE, DMARC DONE. Added GitHub security toggles + Dependabot triage.

## 🌅 This morning — Phase CAT overnight output is READY-TO-PUSH

Overnight loop finished clean (category matching + taxonomy unification + RN fixes). All local gates green (pytest 35/3, babel 115/0, flow graph 0 broken). Nothing pushed — your call.

- [ ] **(Bucket C — approve + push)** Working tree has 14 modified + 5 new files (full list in `STATUS.md` → "Waiting On"). Review, then push `main`. This fixes walkthrough **bug #1** (lawncare business seeing cleaning/massage posts) at the root: business feed now filters to own category + related + General.
- [ ] **(Bucket B — verify after Render autodeploy)** `python3 tools/e2e_smoke.py https://swingbyy-api.onrender.com` must ALL PASS (incl. the new business-feed check). Then on-device (Expo Go, after pull): lawncare dashboard shows only Landscaping(+General) posts; the gesture-handler error is gone.
- [ ] **(Bucket B — D2.2 PDF, optional)** Once a sandbox booking is completed on Render: open a completed booking → "View receipt" → "Download PDF" → confirm the PDF opens in iOS Safari with all fields. (Code is done; this is the only unverified piece.)
- [ ] **(D4 tester kit is drafted)** `Roadmap/dominoes/D4-tester-brief.md` + `D4-bug-capture-sheet.md` are ready — fill the `{{EXPO_LINK}}` placeholder when you line up a tester.

## ⛔ Blocking (loop stuck until done)

- [ ] **(Bucket B — rotate + secret the Google Maps key)** `mobile/app.json` had the real Android Maps key in plaintext (`AIzaSyDW…nyJw`) — flagged as **H1** in the 2026-07-01 audit. **The repo is PUBLIC, so treat the old key as fully compromised.** Placeholder is now committed; Kira must:
  1. Google Cloud Console → API keys → find the leaked key → **Regenerate** (invalidates the old value).
  2. New key → restrict by Android package `com.swingby.app` + SHA-1 fingerprint from Play Console / EAS credentials.
  3. `eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_KEY_ANDROID --value AIza...` (needs your Expo login).
  4. Update `mobile/app.json` build channel to read from the EAS secret, OR keep the placeholder and inject via `expo prebuild` env if using bare RN.
  5. Verify next EAS build succeeds and Maps renders on Android.

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
- [ ] **(Repo visibility decision)** The GitHub repo is **public**: marketing strategy, investor folder, pricing docs, and CLAUDE.md (incl. `testclient@swingby.dev` test creds + infra IDs) are world-readable. Either make the repo private (Settings → General → Danger Zone) or accept and rotate anything sensitive. If those `.dev` test creds exist in Supabase Auth, disable or rotate them.
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
