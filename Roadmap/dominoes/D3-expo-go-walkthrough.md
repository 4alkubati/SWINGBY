---
type: domino
id: D3
status: pending
phase: 1 — BETA
started:
done:
links: [[../DOMINOES]]
prev: [[D2.5-status-cleanup]]
next: [[D4-friend-tester]]
tags: [domino, qa, walkthrough, expo-go]
---

# 🁢 D3 — Personal Expo Go iOS full walk-through

> Index: [[../DOMINOES|DOMINOES]] · Prev: [[D2.5-status-cleanup|D2.5]] · Next: [[D4-friend-tester|D4 — Friend tester]] · Master log: [[_LEARNING-LOG]]

## 🎯 Goal

You (Kira) complete the **full client + business flow twice** — once via Stripe escrow, once via off-platform cash — on your own iPhone using Expo Go. Zero blocker bugs left at the end.

This replaces the original D3 ("EAS installable build") for as long as the "don't spend money yet" posture holds. Paid installable distribution moves to [[D5-paid-testers|D5]].

## 🤔 Why this matters

Until you yourself can walk the full beta loop without thinking, no friend can. This is the cheap rehearsal.

## ✅ Pre-reqs

- [ ] [[D2.1-employee-trust-card|D2.1]], [[D2.2-invoices|D2.2]], [[D2.3-offplatform-pay|D2.3]], [[D2.4-business-subscription|D2.4]] all shipped to Render.
- [ ] Seed accounts created (this normally lives in [[D4-friend-tester|D4]] pre-reqs but you need at least client + business now).
- [ ] Stripe test keys in Render env (so the card flow works).

## 🪜 Step-by-step

### 1. Run A — Stripe escrow flow
- Sign in as `testclient@swingby.dev`.
- Browse Nearby / Search → find Test Cleaning Co.
- Or Post a job → see business express interest → accept quote → booking created.
- Confirm date → business taps "On my way" → status updates on client side via timeline poll.
- Business "Arrived" → "Start" → attach before photo → "Complete" → attach after photo.
- Client taps "Pay with card" → Stripe Checkout opens in Safari → use `4242 4242 4242 4242` → confirm `payments.status='paid_full'`.
- Client leaves review → business sees review.
- Both tap "View receipt" → in-app receipt + PDF download.

**Verify:** booking flips through every status, photos persist, push notifications land, receipt PDF opens.

### 2. Run B — Off-platform cash flow
- Repeat Run A through "Complete" with after photo.
- Client taps **"Mark as paid (cash/e-transfer)"** instead → modal → Cash → confirm.
- Receipt PDF now shows method = Cash. No platform_cut. Subscription on business is what monetizes.

### 3. Subscription edge cases
- Sign in as a brand-new business → confirm subscription onboarding hits (per [[D2.4-business-subscription|D2.4]] decision).
- Try to accept an interest while sub status = `past_due` (use Stripe Dashboard to force) → confirm 402 + redirect-to-Plan UX.

### 4. Other screens not on the golden path
Touch every screen [[D2.0-live-walkthrough|D2.0]] flagged. Confirm earlier bugs are fixed. Log any regressions.

### 5. Log every bug
Append to this file's `📖 Log` below, and/or [[../July/2026-07-03|the Jul 3 daily]], tagged D3.

### 6. Triage + fix loop
- 🔴 blocker → fix today, retest.
- 🟡 major → file, fix by tomorrow.
- 🟢 minor → park to [[D5-paid-testers|D5]] backlog.

Repeat steps 1–4 until your full Run A + Run B pass back-to-back with zero blockers.

## 🏁 Done-rule

- [ ] Run A passes back-to-back, no blocker bugs.
- [ ] Run B passes back-to-back, no blocker bugs.
- [ ] Subscription gating works in both directions.
- [ ] Bug list filed and triaged.

## 📖 Log (append-only)

### YYYY-MM-DD — first entry template
- What you did:
- What broke:
- What you decided:

## 🎓 Learning

- _to fill as you go_
