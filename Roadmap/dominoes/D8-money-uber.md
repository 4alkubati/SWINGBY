---
type: domino
id: D8
status: pending
phase: 1 — BETA
started:
done:
links: [[../DOMINOES]]
prev: [[D7-security]]
next:
tags: [domino, backend, payments, stripe, money, schema]
---

# 🁢 D8 — Money, the Uber way

> Index: [[../DOMINOES|DOMINOES]] · Prev: [[D7-security|D7]] · Master log: [[_LEARNING-LOG]]

## 🎯 Goal

Money moves the way Uber moves it: **authorize** when the booking is confirmed, **capture** when the work is done, **account** in an internal ledger, **pay out** in batches on a schedule. No per-booking escrow transfer, no money reaching a business before the job is finished.

## 🤔 Why this matters

The shipped model pays the business **50% the instant a quote is accepted** (`interests.py:293`) — before any work happens, before any card is charged. A client who cancels has already had half their money handed to someone else. That is the single most dangerous thing in the codebase.

The first rework (2026-07-19) fixed the timing but modelled payouts as a **per-booking Stripe transfer at completion**, which forces a Stripe Connect dependency that does not exist. Kira's correction (2026-07-19) is that Uber does not work that way.

## 🚕 The model Kira specified

1. **Authorization** — a hold is placed on the client's card confirming funds exist. No money moves.
2. **Direct capture** — when the job completes, the full fare is captured into SwingBy's own account.
3. **Ledger accounting** — an internal database records the transaction and computes the business's cut vs the platform fee. **This is bookkeeping, not money movement.**
4. **Payouts** — earnings **accumulate per business** and are disbursed on a schedule (regular deposit, or instant cash-out on request). *Not* held in a per-booking escrow tied to one job.

### The thing this unlocks

Because payouts are **batched, not per-booking**, they do not need Stripe Connect to launch. The ledger says "this business is owed $340 this week"; you send it manually and mark it settled. **Connect becomes a scale problem, not a launch blocker.**

### The thing to not get wrong

A number on the business analytics screen is **step 3, not step 4**. Seeing correct earnings in the app proves the ledger works. It does not mean any money has left SwingBy's account. Those are different systems and only one of them is built.

## ✅ Pre-reqs

- [ ] [[D6-m1-gate|D6.1]] merged — this builds on `card-01-sync`.
- [ ] A Stripe **sandbox** secret key present in `backend/.env`. There is none on this box today, which is why the 2026-07-19 build could not run a live sandbox pass.

---

## 🪜 D8.1 — Capture at completion, accrue in the ledger

Branch `card-21-money` (`1632f1c`) already did the hard half: accept no longer releases 50%, completion is the sole release point, refunds come from the platform balance, 17 tests, suite green at 90. **Rework, don't restart.**

### Step 1 — move the capture
Today it captures the full amount at confirmation. Switch to a Stripe PaymentIntent with `capture_method: 'manual'` — authorize at confirmation, capture at completion.
> **Verify:** a sandbox booking shows an *uncaptured* PaymentIntent after confirmation, and a captured one only after `complete_booking`.

### Step 2 — accrue, don't transfer
Replace the per-booking transfer with a ledger accrual: on capture, write the business's share to a running balance rather than moving funds.
> **Verify:** completing a booking creates no Stripe transfer, and the business's accrued balance increases by `total − 10%`.

### Step 3 — the ledger view
`/admin/ledger` already exists and flags cent-level mismatches instead of silently reconciling. Extend it to show, per business: accrued, paid out, outstanding.
> **Verify:** two completed bookings for one business roll into one outstanding balance matching the Stripe dashboard to the cent.

### Step 4 — refunds
Refunds before completion cancel the authorization (nothing captured, nothing to claw back). After completion, refund from the platform balance and **debit the accrual** — never claw back from a business already paid.
> **Verify:** a pre-completion cancel releases the hold with no charge; a post-completion refund reduces the outstanding balance.

## 🪜 D8.2 — The payout rail (decision, then build)

**Beta:** manual. Ledger reports what's owed, Kira sends e-transfer, marks it settled. Needs a `payouts` table and a "mark settled" action — no Connect, no KYC.
**Scale:** Stripe Connect — business onboarding, identity, bank details, KYC. Real work, correctly deferred.

> **Done-rule:** a decision is written in the log below, and if manual, a business can be marked paid and their outstanding balance returns to zero.

## 🪜 D8.3 — Execute every refund and penalty path

Against the new model, run every cancellation path in sandbox: before confirm · 25% penalty (>48h) · 50% penalty (≤48h) · post-confirmation no-show.

> **Done-rule:** a table of path → designed outcome → **actual Stripe result** → ledger row, every row executed, mismatches flagged as decisions. Nothing "should work."

## 🏁 Done-rule (the whole domino)

A sandbox booking runs authorize → capture-at-completion → ledger accrual → batched payout; the ledger matches Stripe to the cent; **nothing reaches a business before completion**; and every refund path has been executed rather than reasoned about.

---

## 📖 Log (append-only)

### 2026-07-19 — first rework built, then corrected
- `card-21-money` `1632f1c`: killed the 50%-at-accept release, made completion the sole release point, added `/admin/ledger`, 17 tests. Verified the tests bite by deliberately breaking the release math and confirming failure before reverting.
- Could not run live sandbox: no `STRIPE_SECRET_KEY` and no real Supabase creds on the box. Declined to run `e2e_smoke.py` against **prod** — that would have validated the old code, not the branch. Correct call.
- `create_transfer` built but left unwired: no Stripe Connect onboarding exists anywhere in the codebase.
- **Kira's correction, same day:** Uber does not escrow per trip. It authorizes, captures at completion, accounts internally, and **batches payouts**. This retires the per-booking-transfer design and with it the Connect blocker for beta.
- Kira asked whether the ledger already works, having seen numbers in business analytics. Answer recorded: analytics proves step 3 (accounting), not step 4 (money leaving the account). Both real, only one built.

## 🎓 Learning

- **Copy the mechanism, not the vibe.** "Uber-style escrow" and Uber's actual flow are different systems. The real one is *simpler* — batching removes the hardest dependency.
- **A screen showing money is not money.** Ledger correctness and fund movement are separate systems; conflating them is how a platform discovers at payout time that it has no rail.
- **An agent refusing to produce a green check is doing its job.** Running the smoke test against prod would have "passed" and meant nothing.
