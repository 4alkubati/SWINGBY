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
**Vision slice each agent reads:** [[../AGENTS/claude/PRODUCT-VISION|PRODUCT-VISION.md]].
**Live state of the build:** [[../AGENTS/claude/memory/STATUS|STATUS.md]].
**What only a human can do:** [[../AGENTS/claude/memory/HUMAN-TODO|HUMAN-TODO.md]].

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
- [ ] **D2 expanded — pages we still need before beta is real:**
  - [[dominoes/D2.0-live-walkthrough|D2.0 — Live walk-through audit]]
  - [[dominoes/D2.1-employee-trust-card|D2.1 — Employee trust card to BusinessProfile parity]]
  - [[dominoes/D2.2-invoices|D2.2 — Invoices (in-app receipt + PDF)]]
  - [[dominoes/D2.3-offplatform-pay|D2.3 — Off-platform "mark as paid"]]
  - [[dominoes/D2.4-business-subscription|D2.4 — Business subscription (off-platform monetization)]]
  - [[dominoes/D2.5-status-cleanup|D2.5 — STATUS.md + roadmap files cleanup]]
- [ ] **D3** [[dominoes/D3-expo-go-walkthrough|— Personal Expo Go iOS full walk-through]]
- [ ] **D4** [[dominoes/D4-friend-tester|— Friend/known-trade end-to-end run]]
- [ ] **D5** [[dominoes/D5-paid-testers|— Hire real dev testers (Phase 2 — money cleared)]] — paid path: Apple Dev, Play, EAS.

Meta: [[dominoes/_LEARNING-LOG|_LEARNING-LOG]] — the book that grows across dominoes.

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
