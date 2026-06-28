---
type: domino
id: D4
status: pending
phase: 1 — BETA
started:
done:
links: [[../DOMINOES]]
prev: [[D3-expo-go-walkthrough]]
next: [[D5-paid-testers]]
tags: [domino, qa, beta, testers]
---

# 🁢 D4 — Friend / known-trade end-to-end run

> Index: [[../DOMINOES|DOMINOES]] · Prev: [[D3-expo-go-walkthrough|D3]] · Next: [[D5-paid-testers|D5 — Paid testers]] · Master log: [[_LEARNING-LOG]]

## 🎯 Goal

A real other human (1 friend or known trade) completes a real booking on your live system. **This is when "beta" stops being aspirational and becomes a verb.**

## 🤔 Why this matters

You can't see your own blind spots. The minute a non-Kira hands their phone to the app, the first 5 surprises happen. Catch them before [[D5-paid-testers|paid testers]] hit the same wall.

## ✅ Pre-reqs (mostly human-only)

- [ ] [[D3-expo-go-walkthrough|D3]] passed cleanly.
- [ ] **Seed accounts created in Supabase Auth** (see [[../../credentials/test-accounts/seed-accounts|seed-accounts.md]]):
  - Supabase Dashboard → Authentication → Users → Add user × 3 (client + business + employee), Auto-Confirm ON.
- [ ] **Stripe test keys + webhook on Render**:
  1. Stripe Dashboard → Developers → API keys → reveal `sk_test_…` → paste into Render env as `STRIPE_SECRET_KEY`.
  2. Stripe Dashboard → Developers → Webhooks → Add endpoint:
     - URL: `https://swingbyy-api.onrender.com/payments/stripe/webhook`
     - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
     - Reveal signing secret `whsec_…` → paste into Render env as `STRIPE_WEBHOOK_SECRET`.
  3. Paste `STRIPE_BUSINESS_PRICE_ID` (from [[D2.4-business-subscription|D2.4]] step 2) into Render env.
  4. Trigger Render redeploy.

## 🪜 Step-by-step

### 1. Brief your tester (5 min)
- Pick 1 person you know. Trade is best (real category), friend is fine.
- Send them Expo Go install link + QR access.
- Frame: "This is alpha. Tell me everything that confuses you. Bugs are valuable."

### 2. Sit with them, don't drive
Observe. Don't grab the phone. Note every:
- 🤔 Confusion (they look at the screen too long).
- 😬 Frustration (taps the wrong thing twice).
- 💥 Bug (broken behavior).
- 🌟 Reaction (positive surprise — keep these too).

### 3. Walk one of:
- **Path A** — they're a client: post a job, see business response, accept, message, complete, review, receipt.
- **Path B** — they're a business: receive an interest, accept, deliver Live Status updates, receive payment.

### 4. Debrief (5 min after)
Ask:
1. What confused you most?
2. Would you actually use this for your next job?
3. What's missing that would make you say yes?

### 5. File everything
New section in today's daily file:
```markdown
## D4 — Friend tester ({name}, {trade})
### Bugs
- [ ] ...
### Confusion points
- ...
### Quotes
- "{their words}"
### Decisions
- ...
```

### 6. Triage
Same rule as [[D3-expo-go-walkthrough|D3]]: 🔴 blockers fixed now, 🟡 majors before next tester, 🟢 minors parked.

### 7. Decide: ready for [[D5-paid-testers|D5]]?
If the tester completed the flow + the bug list is finite + the "would you use this" is yes-leaning → declare **BETA LIVE** and advance.

If not → fix, find another friend, repeat.

## 🏁 Done-rule

- [ ] One real other human completed one real booking on live SwingBy.
- [ ] Bug list captured + triaged.
- [ ] You have a yes/no read on "is this real for them?"
- [ ] BETA LIVE declared (or another D4 run scheduled).

## 📖 Log (append-only)

### YYYY-MM-DD — first entry template
- What you did:
- What broke:
- What you decided:

## 🎓 Learning

- _to fill as you go_
