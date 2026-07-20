---
type: domino
id: D6
status: active
phase: 1 — BETA
started: 2026-07-19
done:
links: [[../DOMINOES]]
prev: [[D5-paid-testers]]
next: [[D7-security]]
tags: [domino, gate, mobile, backend, schema, release]
---

# 🁢 D6 — M1 GATE: the app survives your own 15-minute run

> Index: [[../DOMINOES|DOMINOES]] · Next: [[D7-security|D7 — Security]] · Master log: [[_LEARNING-LOG]]

## 🎯 Goal

A fresh pull of `main`, installed on **your** Android phone, survives a full walkthrough — signup → browse → view business → book → chat → confirm → complete → receipt — with zero crashes and zero dead ends. Three times in a row for the scripted agent run, once for yours.

## 🤔 Why this matters

Every tester invitation, every outreach message, every "come try it" is blocked behind this. Twice now the plan has assumed testers had already run when they hadn't. **Agent-clean is not done.** An agent on this box cannot open the app — there is no emulator, no `adb`, no `node`. So until a human holds a phone, nothing is verified, only written.

## ✅ Pre-reqs

- [ ] Nothing. This is the front of the chain. Everything else waits on it.

---

## 🪜 D6.1 — Apply the migrations, then merge

**Four** migrations are written, tested, and filed. Until applied, `card-01-sync` cannot merge and live paths error. Migrations ship *with* the code — the Jul 17 outage rule.

### Step 1 — reconcile before you touch migration 3
Say **"reconcile the constraints"** to Claude. Migration 3 drops and recreates a live CHECK constraint that may have drifted from what the repo believes. That exact drift class caused the Jul 17 dashboard outage. Takes ~30 seconds against `pg_constraint`.
> **Verify:** Claude reports the live constraint definition and whether it matches the repo DDL.

### Step 2 — run them in order
Open https://supabase.com/dashboard/project/ulnxapnsenzyddddldjt/sql/new and run **one at a time**, confirming each before the next:

| # | File | Does | Risk |
|---|---|---|---|
| 1 | `docs/service_posts_preferred_date.sql` | adds one nullable column | none — additive |
| 2 | `docs/referrals_table.sql` | creates `referrals` | none — new table |
| 3 | `docs/booking_events_event_type_extend.sql` | drop+recreate a CHECK | **reconcile first** |
| 4 | `docs/reviews_reviewee_type_extend_employee.sql` | lets reviews target an employee | none — widens a CHECK |

Files 1–3 are on `card-01-sync`. **File 4 lives on `agent-mobile-product`** — ask Claude for it if you don't see it.

> **Verify:** each returns success. What each turns back on (all dead against live right now):
> 1 → the post-a-job preferred-date field · 2 → `GET /me/referrals`, currently 400s · 3 → dispute + off-platform events reaching the timeline, currently **silently discarded** · 4 → employee reviews saving at all

### Step 3 — merge
Tell Claude **"migrations applied"**.
> **Verify:** `card-01-sync` merges to `main`, Render redeploys, doctor returns all-clear, prod endpoints 200.

---

## 🪜 D6.2 — The scripted run

Script the walkthrough and run it against a fresh clone of `main`. Fix every crash and dead end. Repeat until clean.

Covers both D2 entry paths once [[D8-money-uber|D8]] and D9.3 land: with-time → booking chat, without-time → disappearing chat → agree time → booking chat.

> **Done-rule:** three consecutive clean runs from a fresh pull, plus a written crash log (what broke / why / what fixed it).

### Carried in from the card era
- **Maps:** `mobile/app.config.js` injects `GOOGLE_MAPS_API_KEY` from env. Code is done; pasting the key into `mobile/.env` is the only remaining action. Maps only activate in a dev/EAS build — **Expo Go ignores it on Android.**
- **i18n:** 22 missing keys were defined across EN/fr-CA/ar; a static scan shows 0 missing. Unverified visually.

---

## 🪜 D6.3 — Your run

Fresh pull of `main`, your Android, 15 minutes, the full journey.

> **Done-rule:** you complete it with no crash and no dead end. **This is the only thing that closes M1.** If anything breaks: screenshot → `~/brain/inbox/` and it gets fixed that night.

---

## ⚠️ Open rulings needed from Kira

- **D9.3 booking-entry fork.** The D2 spec said *"time given at posting → straight to booking chat."* Architecturally impossible as written — no booking exists at posting time in post-and-match. The build put the fork at **quote-acceptance** instead: post had a `preferred_date` → accepting a quote stamps `confirmed_date` and drops into booking chat, skipping the handshake. Functionally what you described, one stage later. **Confirm this is what you meant**, or say so and it moves.

## 🏁 Done-rule (the whole domino)

`main` carries all four migrations and the merged work, the scripted run passes 3× clean, and **you** have completed the walkthrough on your own phone. Until all three are true, D6 is open and tester outreach stays paused.

---

## 📖 Log (append-only)

### 2026-07-19 — converted from cards, chain opened
- Absorbed CARD-01/02 (D6.1), CARD-03/04 (D6.2), CARD-11 (D6.3). Cards retired as a system.
- Migration count corrected 3 → 4: overnight work added `reviews_reviewee_type_extend_employee.sql`.
- Recorded that this box cannot verify mobile at all — no `node`, `npx`, `adb`, or emulator. Five agents that night all reported "code-complete, unverified on device." That is honest, not underperformance, and it is exactly why D6.3 exists.

## 🎓 Learning

- **A done-condition that needs a tool the machine lacks is not a done-condition.** Check what a card *physically requires* before dispatching it, or it lands 90% finished by construction.
- **The merge gate is load-bearing.** One unmerged branch held four dominoes' worth of verified work. Migrations-with-code is the rule that keeps it honest, but it means the human step is the bottleneck — schedule it first, not last.
