> ## 🔄 RECONCILED — 2026-08-02
>
> **This is the ordered PLAN. It is not the live state.** Know which question you
> are asking:
>
> * **"What is the next thing to do?"** → this file. Reconciled 2026-08-02 against
>   `origin/main` and live production probes; every ✅ below now names its evidence.
> * **"What is actually live right now?"** → **`Roadmap/STATUS.md`** — verified
>   against live code, the live database and prod HTTP.
> * **"What is blocking launch?"** → **`Roadmap/LAUNCH-BLOCKERS.md`** (M1–M20).
> * **"What can only Kira do?"** → **`Roadmap/HUMAN-TODO.md`**.
>
> *Why this banner changed:* on 2026-07-31 it read **SUPERSEDED — do not plan from
> it**, because the file had sat since 2026-07-22 with ✅ marks that described
> branches rather than production. That staleness is what the 2026-08-02 pass fixed
> (see the Log). The split it was pointing at is real and stands — plan here, live
> state in `STATUS.md` — so it is stated as a division of labour instead of a
> retirement notice.

---
type: index
status: active
phase: 1 — BETA
started: 2026-06-26
owner: Kira
tags: [roadmap, dominoes, beta, plan]
---

# 🁢 DOMINOES — the path to BETA

> The single ordered list of dominoes between today and a real tester completing a booking. Each domino lives in its own file under `[[dominoes]]`. Each file follows the **book convention**: never edit history, append new entries at the end under `📖 Log` and capture lessons under `🎓 Learning`.

**North star:** [[README|Roadmap/README]] — by Aug 31, SwingBy is live and real people are transacting.
**Vision slice each agent reads:** `~/brain/10-swingby/agents/claude/PRODUCT-VISION.md`.

**Live state / blockers / human-only:** see the banner at the top of this file.

> ⚠️ **Cite the `Roadmap/` copies, not the brain ones.** These three used to be listed
> here as `~/brain/10-swingby/agents/claude/memory/*`. The brain has **no git remote**,
> so those copies cannot reach the laptop, and by 2026-08-02 they had drifted ~11 days
> behind. The `Roadmap/` versions travel with the repo and are authoritative.

---

## 📐 The book convention (read once, then forget)

Every domino file follows the same shape, top to bottom:

1. **Frontmatter** — Obsidian YAML (`status`, `started`, `done`, `links`, `tags`).
2. **Goal** — one sentence, what "done" looks like.
3. **Why** — why this domino exists in the chain.
4. **Pre-reqs** — wikilinks to upstream dominoes or human actions that must be cleared first.
5. **Step-by-step** — numbered, copy-pasteable, smallest-possible steps. Each step ends with a verify line.
6. **Done-rule** — the binary check that lets you cross it off.
7. **📖 Log (append-only)** — dated entries added at the end as you work. Never edit a prior entry. Even mistakes stay (with a follow-up entry correcting them). Like chapters of a book.
8. **🎓 Learning** — short bullets captured during execution. Principles, surprises, gotchas. Compounds across dominoes via [[dominoes/_LEARNING-LOG|the master learning log]].

**Why append-only?** You don't lose context when you revisit a domino in 3 months. You see *what we tried, in order, and why we changed direction.* This is the project's memory — the orchestrator LOOP, future-you, and any agent reading the file all benefit.

---

## 🧭 Where we are right now (verified 2026-06-26)

- [x] **D1 — Email sends** ✅ committed `08715e3`, 5 lifecycle emails wired, branded magic link delivers from `team@swingbyy.com`.
- [x] **D2 — Kill mock data** ✅ zero mock/dummy/fake/hardcoded strings in `mobile/src/screens/`. Mobile `.env` already points at Render. **Verification walk-through still owed → [[dominoes/D2.0-live-walkthrough|D2.0]].**
- [x] **D2 expanded — pages we still need before beta is real:** ✅ **all six closed, reconciled 2026-08-02**
  - [x] [[dominoes/D2.0-live-walkthrough|D2.0 — Live walk-through audit]] — done 2026-07-11
  - [x] [[dominoes/D2.1-employee-trust-card|D2.1 — Employee trust card to BusinessProfile parity]] — endpoint live + gated; screen on main
  - [x] [[dominoes/D2.2-invoices|D2.2 — Invoices (in-app receipt + PDF)]] — both endpoints live; prod break fixed in #33
  - [x] [[dominoes/D2.3-offplatform-pay|D2.3 — Off-platform "mark as paid"]] — endpoint live + gated; wired in BookingDetails
  - [x] [[dominoes/D2.4-business-subscription|D2.4 — Business subscription]] — live under the **`/businesses`** prefix (not `/subscriptions`)
  - [x] [[dominoes/D2.5-status-cleanup|D2.5 — STATUS.md + roadmap files cleanup]] — closed by the `Roadmap/` status set (#82)
- [ ] **D3** [[dominoes/D3-expo-go-walkthrough|— Personal iOS full walk-through]] 🔄 **in-progress** — a first iOS walkthrough ran 2026-07-31 on an **ad-hoc build, not Expo Go**, and found M2/M3/M4. Needs a clean re-run now #83 has landed. *The "Expo Go" framing is historical — Expo Go cannot exercise the native pay sheet, wallets, or Sign in with Apple.*
- [ ] **D4** [[dominoes/D4-friend-tester|— Friend/known-trade end-to-end run]] 🔴 **the real remaining gate** — no other human has completed a booking on live SwingBy. Cannot be closed by an agent.
- [ ] **D5** [[dominoes/D5-paid-testers|— Hire real dev testers (Phase 2 — money cleared)]] — still deferred, but the gate has **partly lifted**: Apple Developer is paid (2026-07-30), Team ID `ZTYJ33HPDX` on main.

Meta: [[dominoes/_LEARNING-LOG|_LEARNING-LOG]] — the book that grows across dominoes.

---

## 🧭 2026-07-22 reconciliation — what actually landed this week

> The D6–D10 tree below was last reconciled 2026-07-20. Between then and 2026-07-22 a full product wave merged to `main`. Recorded here honestly so the tree stops lagging reality.

**Merged to `main` (Jul 21–22):**
- **#29 / #30 / #31 — Money + account lifecycle** → escrow ledger correctness (no release before capture, real cancel refunds, webhook idempotency), ToS cancellation ladder + customer credit ledger, account lifecycle (suspension, soft-delete, ghost mode, audit log), Notion CRM dropped. *Advances D8.1/D8.3 — but not the D8 pay-before-service rework, which is still parked (see below).*
- **#33 — Invoices** → phantom-column 500 fixed + PDF auth via query token + regression tests. *Closes the D2.2 prod break.*
- **#34 — Direct "Book now"** → post a job to one business, category step dropped. *Extends D9.3 booking-entry.*
- **#35 — Chat stack** → booking-first chat, instant sends, one unified chat screen, push off the send path.
- **#36 — Jobs + Home** → client Home rebuilt around the live job; Jobs view fixed; StatusBadge pills.
- **#37 — Semantic search** → work-history semantic search.
- **#38 — Profiles + avatar/logo** → client + business profile redesigns wired to avatar/logo.

**Still open (draft PRs, NOT on main):** #22 (S1 RLS column lockdown), #23 (payment-model core), #26 (mobile dead-nav + stop fake data), #27 (reality-sync API/schema/flow-graph + MIGRATIONS.md), #28 (security & legal register). Plus 15 stale dependabot bumps.

**Net effect on the chain:** D6 is CLOSED (walkthrough done). The blocker is no longer "does it work" — it's "verify it renders + functions end-to-end on a clean build before paying Apple ($99/yr) + the monthly rail (~$7/mo)." That verification pass is the new near-term gate → see [[#🔍 D6.4 — pre-spend verification sweep]].

### 🔍 D6.4 — pre-spend verification sweep 🔴 **the new near-term gate**
Before the Apple Developer + monthly-service spend, every user-facing surface must be proven to **render correctly and function end-to-end** on a fresh build of `main` — not agent-smoke-only, actual screens. Kira is writing the full checklist; agents execute + verify each item and report against it. Lanes get dispatched per section as the list lands.

---

## 🁢 D6 → D10 — the chain after the 40-fault audit (added 2026-07-19)

> The Jul 19 "attack plan" ran as **cards** (CARD-01…24) in a file outside the repo — a second planning system running beside this one. **Cards are retired. Dominoes are the only system.** Everything they covered is folded in below, with work already done recorded honestly against it.

> ## ⚖️ THE DONE-RULE (added 2026-07-20, learned the hard way)
> **A domino is done when it is ON `main`. Not committed. Not pushed to a branch. Not reported done. On main.**
>
> Only `main` deploys. On 2026-07-19 thirteen branches had accumulated, and D9.1–D9.6 / D10.4–D10.6 were all ticked ✅ on the strength of "committed and pushed" — while none of them were live. Worse, D9.6 (the client-PII P0) had been **silently reverted** by a stale WIP commit landing on top of it, so `privacy.py` and its 515 lines of tests sat in the tree looking finished while real client addresses and last names stayed public in production for a day.
>
> Before ticking any box: `git ls-tree origin/main <the-file>`. If it isn't there, it isn't done.

### [[dominoes/D6-m1-gate|D6 — M1 GATE]] 🟢 **CLOSED 2026-07-22**
The app survives Kira's own 15-min walkthrough on a fresh pull of `main`. Tester outreach stays shut until it closes.
- [x] **D6.1** — ✅ 2026-07-20. All 4 migrations were already applied live (verified against `information_schema` / `pg_constraint`, **not** `list_migrations` — raw-SQL migrations never register there). 13 branches collapsed into `main` via PR #16 (`403a2b4`). Prod `/health` 200.
- [x] **D6.2** — scripted 15-min run. *Prod e2e smoke ALL PASS against `403a2b4` (2026-07-20): post → quote → chat → accept → propose → handshake → en_route → complete → escrow fully_released.*
- [x] **D6.3** — ✅ **Kira's own phone run, 2026-07-22.** Walkthrough done on device. M1 gate closed — the chain past D6 is now live and tester outreach is unblocked, pending the pre-paid-account verification pass (below).

### [[dominoes/D7-security|D7 — Security + honest instruments]] 🟡
- [ ] **D7.1** — secret rotation: Telegram token + `.dev` creds (Kira generates, agent verifies old ones dead)
- [ ] **D7.2** — Supabase advisors → zero. *2 of 3 cleared live; HIBP toggle is dashboard-only, outstanding.*
- [ ] **D7.3** — monitoring proven. *Analytics verified live (Plausible 202). Sentry unprovable — no dashboard creds on this box.*

### [[dominoes/D8-money-uber|D8 — Money, the Uber way]] 🟡 **danger closed, mechanism outstanding**
**Client pays at confirmation** (Kira 2026-07-19) → ledger accrues → **batched** payout. Replaces the per-booking-transfer model.

> Re-read 2026-08-02. This was 🔴 on the strength of a danger that has since been fixed — by a *different* design than the one below. The unsafe payout is gone; the ledger and the payout rail are not built. **The open question is D8.2, and it is a founder decision, not a build task.**
- [ ] **D8.1** — capture timing stays as built; ledger accrues per business instead of per-booking transfer.
  - ✅ **The danger this domino exists to stop is CLOSED.** The 50%-at-accept release is gone: `backend/app/api/interests.py:563` writes `released_to_business=0`, and release is approval-gated via `backend/app/services/approvals.py` (M1 fix, #81). Copy scrubbed in #84/#86.
  - ❌ **The ledger itself was never built.** No `payment_ledger`; both filed migrations (`docs/payment_ledger_table.sql`, `docs/bookings_payment_status_add_pending.sql`) are **absent from `origin/main`**.
  - ⚠️ **The old instruction here is void.** It said "PARKED on branch `card-21-money` — do NOT merge yet". **That branch no longer exists** (not in `git branch -r`, not local). Anyone following the old text will look for a branch that is gone. What shipped instead is charge-before-service + approval-gated escrow — a different design that solved the same danger.
- [ ] **D8.2** — payout rail decision: manual for beta vs Stripe Connect
- [ ] **D8.3** — execute every refund/penalty path in sandbox, actual vs designed

### D9 — Product P0s 🟢 *ON MAIN as of 2026-07-20 — still unverified on device*
Built 2026-07-19 on branches; **none of it was live until the 2026-07-20 collapse** (PR #16). Every box below re-verified present on `main` by file, not by commit message. Still no emulator on the box, so "runs correctly on a phone" remains D6.3's job:
- [x] **D9.1** reviews wired to real data — on main *(reviewee_type migration still unapplied)*
- [x] **D9.2** referrals real backend — on main; `referrals` table confirmed live in Supabase
- [x] **D9.3** booking-entry per D2 — on main; preferred_date → straight-to-booking path smoke-covered
- [x] **D9.4** business Jobs view + biometrics — on main (`biometrics.js`, `BiometricLockScreen`, Settings toggle, AuthContext)
- [x] **D9.5** rebook loop + favorites — on main (`useFavorites.js`, `FavoritesScreen`)
- [x] **D9.6** client-PII leak fixed (P0) — on main and **verified live in prod 2026-07-20**: feed returns `address='Calgary'`, `last_name=None`. ⚠️ Was reverted by stale WIP commit `0e005c6` and re-wired in `c926eec` — see the done-rule above.

### D10 — Launch surface 🟡
- [ ] **D10.1** — deploy `web/launch` to replace the frozen `web/pre-launch` build on swingbyy.com *(**not** legal exposure — see the 2026-08-03 correction below; the live risk is stale copy, including the false 50/50 payment claim)*
- [ ] **D10.2** — DMARC → quarantine. *Record drafted and ready; DNS is Kira's step.*
- [ ] **D10.3** — waitlist count into the morning brief *(blocked: no `NOTION_TOKEN` on the box)*
- [x] **D10.4** — analytics funnel — `services/analytics.py` on main as of 2026-07-20 *(was on a branch only; the earlier "verified live" referred to Plausible on the website, not this funnel)*
- [x] **D10.5** — money-path failure tests — `test_money_paths_failures.py` on main; full suite 156 passed / 3 skipped
- [x] **D10.6** — app screens on the website — on main *(the CARD-22 copy repeated the old "no contact until they accept" claim; resolved in favour of D10.7's corrected wording — chat opens at the quote)*
- [x] **D10.7** — docs match shipped behaviour — on main *(2 decisions still await Kira: beta invite card, inbox cleanup)*

### Card → domino map (so the old reports stay findable)

| Card | Domino | Card | Domino |
|---|---|---|---|
| 01, 02 | D6.1 | 14 | D10.7 |
| 03 | D6.2 | 15 | D10.1 |
| 04, 11 | D6.2 / D6.3 | 16 | D10.2 |
| 05 | D7.1 | 17 | D10.3 |
| 06 | D7.2 | 18 | D10.4 |
| 07 | D7.3 | 19 | D10.5 |
| 08, 09, 10 | D9.1 / D9.2 | 20 | D9.3 |
| 12 | D9.5 | 21, 13 | D8 |
| 22 | D10.6 | 23 | D9.6 |
| 24 | D9.4 | | |

Agent reports for all of these live in `~/brain/inbox/` — **this box only**, brain has no remote yet.

---

## 🗂️ The folders we're touching (links so Obsidian graph shows them)

- Backend code: [[../backend/app|backend/app]] — FastAPI routes, models, services.
  - Auth/email: `[[../backend/app/api/auth.py]]`
  - Bookings: `[[../backend/app/api/bookings.py]]`
  - Payments (Stripe): `[[../backend/app/api/payments_stripe.py]]`
  - Booking events (live status): `[[../backend/app/api/booking_events.py]]`
  - Photos: `[[../backend/app/api/booking_photos.py]]`
  - Uploads: `[[../backend/app/api/uploads.py]]`
  - Migrations + schema: [[../docs/swingby_database_schema|docs/swingby_database_schema.md]]
- Mobile code: [[../mobile/src|mobile/src]] — screens, navigators, services, components.
  - Screens by bucket: `[[../mobile/src/screens/auth]]`, `[[../mobile/src/screens/business]]`, `[[../mobile/src/screens/client]]`, `[[../mobile/src/screens/flows]]`, `[[../mobile/src/screens/messages]]`, `[[../mobile/src/screens/onboarding]]`, `[[../mobile/src/screens/profile]]`, `[[../mobile/src/screens/shared]]`, `[[../mobile/src/screens/admin]]`.
  - Navigators: `[[../mobile/src/navigation/ClientNavigator.js]]`, `[[../mobile/src/navigation/BusinessNavigator.js]]`, `[[../mobile/src/navigation/AuthNavigator.js]]`.
  - API client: `[[../mobile/src/services/api.js]]`.
- Credentials (gitignored, real values local): [[../credentials/test-accounts/seed-accounts|seed-accounts.md]].
- Daily files: [[June|Roadmap/June.md]] (all of June in one file) · [[July/2026-07-01|Roadmap/July/]] (one file per day).

---

## ⏱️ Master schedule — Jun 27 → Jul 7 (two lanes, run in parallel)

> **Left lane = you (Kira), by hand.** **Right lane = the overnight LOOP (code).** They run the same days so you're never idle waiting on the agents and the agents are never idle waiting on you. Step-by-steps live in the day file (your tasks) and the linked domino file (agent build).

| Date | You (Kira, in parallel) | Overnight LOOP (code) |
|---|---|---|
| **Sat Jun 27** *(today)* | Push D2.5 commit · paste Stripe keys + create 2 products · DMARC TXT · create 3 seed accounts | D2.5 ✅ done · queue [[dominoes/D2.1-employee-trust-card\|D2.1]] for overnight |
| **Sun Jun 28** | [[dominoes/D2.0-live-walkthrough\|D2.0]] walkthrough on iPhone (~1 hr) — file bugs to the June file | [[dominoes/D2.1-employee-trust-card\|D2.1]] — Employee trust card (mobile parity + `/employees/{id}/stats`) |
| **Mon Jun 29** | Review D2.0 bug list → triage blockers back into sub-dominoes | [[dominoes/D2.2-invoices\|D2.2]] — Invoices (in-app receipt + PDF via reportlab) |
| **Tue Jun 30** | Quick on-device verify of D2.1 + D2.2 | [[dominoes/D2.3-offplatform-pay\|D2.3]] mark-as-paid + [[dominoes/D2.4-business-subscription\|D2.4]] backend start (migration + Stripe products + subscribe endpoint) |
| **Wed Jul 1** | — | [[dominoes/D2.4-business-subscription\|D2.4]] — mobile Plan card + gating + webhook |
| **Thu Jul 2** | Smoke test the full chain on Render with seed creds | [[dominoes/D2.4-business-subscription\|D2.4]] finish + verify loop (Stripe Dashboard → past_due → app reflects) |
| **Fri Jul 3** | [[dominoes/D3-expo-go-walkthrough\|D3]] — Expo Go personal walkthrough (deeper than D2.0 — full beta flow) | Standby for bug fixes |
| **Sat–Sun Jul 4–5** | — | Fix D3 bugs (whatever blockers came out of D3) |
| **Mon Jul 6** | Recruit 1 friend tester (FOH-marketing draft parked — polish + send) | — |
| **Tue Jul 7** | [[dominoes/D4-friend-tester\|D4]] — friend tester end-to-end run, you on a call | Hotfix anything that breaks live |

Daily detail: **June** → [[June|Roadmap/June.md]] (one file). **July** → [[July/2026-07-01\|Roadmap/July/]] (one file per day). This is the plan, not a contract — re-order when reality argues.

---

## ✅ NEEDS-KIRA — answered 2026-06-27 (locked in [[dominoes/D2.4-business-subscription|D2.4]])

1. **Billing posture during beta** → track-only (every business `trialing`, no real Stripe charge until public launch).
2. **Price** → Solo $30/mo · Team $80/mo (CAD) · Enterprise = sales. Tier auto-derived from employee count.
3. **Gate** → business cannot accept a booking unless `subscription_status ∈ ('active','trialing')`; a 402 fires at Accept.

Revenue model: customer-side 10% platform cut on in-app card + business-side flat monthly membership. Cash/e-transfer = record-only (no cut). Full reasoning in [[dominoes/D2.4-business-subscription|D2.4]] `📖 Log`.

---

## 📖 Log (append-only)

### 2026-08-02 — reality sync: the tracker had stopped tracking

Full evidence: `agents/claude/deliverables/state-audit-2026-08-02.md`.

**The problem.** A status markup was checked against this tree and 8 of 15 claims
came back refuted — but almost all of that gap was **bookkeeping, not lost work**.
The individual domino files had not been touched in **6–11 weeks** (six still carried
2026-06-27 frontmatter) while the code moved on underneath them. The files said
`pending`; production said the endpoints were live.

**Corrected this pass** — each against `origin/main` or a live prod probe, never
against another doc:

| Domino | Was | Now | Proof |
|---|---|---|---|
| D2.1 | `in-progress` | **done** | `/employees/{id}/profile` → `401` in prod; screen on main; 0 placeholders |
| D2.2 | `pending` | **done** | both invoice endpoints `401`; #33 fixed the prod break |
| D2.3 | `pending` | **done** | `mark-paid-offplatform` → `401`; wired in BookingDetails |
| D2.4 | `pending` | **done** | live under **`/businesses`**, not `/subscriptions` |
| D2.5 | `pending` | **done** | closed by the `Roadmap/` status set (#82) |
| D3 | `pending` | **in-progress** | iOS walkthrough ran 2026-07-31 — ad-hoc build, not Expo Go |
| D6 | `active` | **done (2026-07-22)** | the file was 11 days behind its own index |
| D8 | `pending` | **in-progress** | danger closed (#81/#84/#86); ledger + payout rail still absent |

**Deliberately NOT changed:**
- **D4 stays `pending`.** No other human has completed a booking on live SwingBy. It
  is the most honest remaining gate and no agent can close it.
- **D7 stays `active`.** It was described as "deferred, not partial-now" — but 2 of 3
  Supabase advisors are cleared and analytics is verified live. It is part-done, and
  leaving it `active` keeps that visible.
- **Device-only done-rule boxes stay unticked** across D2.1–D2.4 — screens exist and
  are wired, but nothing here proves they *render*. Those ride with D6.4.

**Two traps removed from this file:**
1. It cited `agents/claude/memory/STATUS.md` as live state. The brain has **no git
   remote**, so that copy cannot reach the laptop and had drifted. Now points at
   `Roadmap/STATUS.md`.
2. D8.1 said "PARKED on branch `card-21-money` — do NOT merge yet". **That branch no
   longer exists.** The instruction would have sent someone hunting for it.

**Still true and still unfixed:** there is **no `D9` and no `D10` file** — both rungs
exist only as sections here. D10.1 (deploy `web/launch`) remains open.

### 2026-08-03 — the "no privacy policy is served" finding was WRONG
That claim appeared here, in the 2026-08-02 state audit, and in the server handoff
brief. **It is false, and it was false because of how it was measured.**

The test compared the HTML of `/`, `/privacy` and a deliberately bogus URL, found them
byte-identical, and grepped that HTML for "PIPEDA" and "personal information" — zero
hits. But swingbyy.com is a **react-router SPA that lazy-loads its routes**, so *every*
URL returns the same shell and the policy text lives in a separate chunk. A correctly
deployed SPA produces exactly the same result. The method could not tell the two apart.

`docs/DEPLOY.md` and `STATUS.md` §6 both already said it: *"`curl -I` proves nothing
about swingbyy.com — grep the deployed bundle."* The audit did not.

Re-tested 2026-08-03 by fetching the chunks the live page actually loads:

| URL | Result |
|---|---|
| `/assets/PrivacyPage-BxcYSXpf.js` | **200**, 4,344 B — "PIPEDA" ×1, "personal information" ×4, "we collect" ×4, sections *1. Information We Collect · 2. How We Use Your Information · 3. Your Rights & Data Retention* |
| `/assets/TermsPage-a5jjFbyw.js` | **200**, 4,801 B — *"By creating an account on SwingBy, you agree…"*, *2. Payments, Escrow & Refunds*, *3. Disclaimers & Limitation of Liability* |
| `/assets/CookiesPage-BAovAQCB.js` | **200**, 3,739 B — a real cookie policy |

**All three legal documents are live on swingbyy.com today.** `HUMAN-TODO.md` H13 was
right — "a real privacy policy is already served" — and was wrongly flagged as a false
claim. There is no legal emergency and no deploy needs to be rushed for one.

**What the same test DID find, and this one is real:** the deployed build is frozen from
before 2026-06-05, so it still publishes the **false 50/50 payment claim** that had to be
pulled from the App Store listing on 2026-07-29 — live right now in three chunks:

- `Home-qRKHrEIJ.js` — *"50% is released to the business on confirmation"*
- `helpArticles-CdspdKrK.js` — *"50% is charged on job completion"*
- `blogPosts-D6K3PNK2.js` — *"half at booking"*

The real model is a single release at completion, gated on client approval
(`backend/app/services/escrow.py`). PR #84 killed this claim in the source; the fix
cannot reach the public until something deploys. **That** is why D10.1 matters — wrong
statements about money, not missing legal pages.

### 2026-07-22 — M1 gate closed + week reconciled
- **D6.3 done** — Kira ran the walkthrough on device. M1 gate CLOSED. D6 flips 🔴→🟢.
- Reconciled the tree against the Jul 21–22 merge wave: #29/#30/#31 (money + account lifecycle), #33 (invoices), #34 (direct Book now), #35 (chat stack), #36 (jobs+home), #37 (semantic search), #38 (profiles+avatar). All on `main`.
- New near-term gate opened: **D6.4 pre-spend verification sweep** — prove every surface renders + functions on a clean build of `main` before the Apple $99/yr + ~$7/mo spend. Kira writing the checklist; agents execute + verify per lane.
- Still-open drafts flagged (not on main): #22, #23, #26, #27, #28.

### 2026-06-26 — index created
- Interview pass with Claude. Verified D1 ✅, D2 code-side ✅, working tree is clean (the 4 fixes and the CHECK bug were already shipped — `STATUS.md` lied).
- Sub-dominoes D2.0 → D2.5 scoped after interview.
- Choices locked: Expo Go iOS until all pages done · friend tester for D4 · build off-platform "mark as paid" + monetization · employee rating wire-up · invoices = in-app receipt + downloadable PDF · monetization model = 10% escrow cut (already wired) + business subscription for off-platform.
- Open: NEEDS-KIRA × 3 still pending in [[dominoes/D2.4-business-subscription|D2.4]].

---

## 🎓 Learning (compounds — also mirrored in [[dominoes/_LEARNING-LOG|_LEARNING-LOG]])

- **Don't trust STATUS.md without `git log` + `git status`.** The orchestrator LOOP can be a step behind reality; the working tree is the truth.
- **Interview before plan, plan before code.** Saved a half-day this round — discovered employee trust card was a real gap and off-platform pay was unbuilt only by asking.
- **The "book" rule prevents amnesia.** Every domino keeps its own append-only log so future-you knows *why* a choice was made, not just *what* exists.
