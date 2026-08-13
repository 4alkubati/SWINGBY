# 01 — Monetization Strategy

> How Swingbyy makes money.

> ### ⚠️ Reconciled against [FACTS.md](FACTS.md) on 2026-08-12
>
> This document listed **five revenue streams and missed the one that exists.**
> The business subscription is live in code — `businesses.subscription_status`,
> a Stripe checkout leg at `payments_stripe.py:428`, gating auto-bidding — and it
> appeared nowhere here, while three unbuilt streams got full sections. It is now
> stream 2.
>
> Also corrected: the platform fee is taken **at release**, not "on completion"
> (§2); the Verified Business badge is marked as requiring a verification flow
> that **does not exist** (§4); and *"verified"* was removed from the risk table's
> mitigation column, where it was doing load-bearing work in an argument.

---

## TL;DR

Swingbyy charges a **10% platform fee** on on-platform bookings, taken from the business side (not the client), at the moment escrow is released to them. There is also a **business subscription** — real, built, and gating auto-bidding — whose price is not yet set. Clients are free, forever.

This is a **classic two-sided marketplace take-rate model** — similar to Thumbtack, TaskRabbit, Uber. The fee is invisible to the client and baked into the quoted price the business shows.

> Was: *"businesses can pay for optional growth features (boosted listings,
> verified badge, lead-pack subscriptions)."* All three of those are **unbuilt**,
> and listing them alongside the fee made the model sound broader than it is.
> The one non-fee stream that exists went unmentioned.

---

## Revenue streams

### 1. Primary — Transaction fee (the marketplace take rate)

| Field | Value |
|---|---|
| Who pays | Business |
| When | **At release** — when the client approves and escrow moves. Not at capture, not on completion |
| Amount | **10% of total booking price** |
| Where it lives in code | `escrow.PLATFORM_RATE`; `backend/app/api/interests.py` → on accept, payment row created with `platform_cut = 0.10 * total`; `stripe_connect.create_transfer` moves total − 10% at release |
| Status | ✅ Implemented (Stripe **sandbox** — no real money has moved) |

> **"On job completion" was wrong, and it is the same error class as the 50/50
> claim.** Completion alone releases nothing — the client approving is what moves
> the money (§2). While a job is open the **full** amount is held, not the amount
> minus our cut: `escrow.compute_hold_cents` is `held = max(total −
> already_released, 0)`. A $190 booking reads $190 held.
>
> That is also a **good** line to sell with: while the job is open, the whole
> amount is sitting there — we take our cut only when the money moves to the
> business.

**Why 10%:**
- Thumbtack charges $5-50 per lead (lead-gen model, no transaction fee). Take-rate equivalent is often 15-30%.
- TaskRabbit takes 15% from taskers.
- Uber takes 20-30%.
- Airbnb takes ~3% from hosts + 14% from guests (~17% total).
- 10% is **the lowest credible take rate in our segment**. We win businesses over by being clearly cheaper.

**When to revisit:** if business CAC < $50 and business LTV > $500, hold at 10%. If LTV-to-CAC ratio drops below 3:1, consider 12% on premium categories.

---

### 2. Primary — Business subscription (BUILT, price not set)

| Field | Value |
|---|---|
| Who pays | Business |
| When | Recurring, via Stripe checkout |
| Amount | **Not set in this repo** — it lives in a Stripe price id |
| Where it lives in code | `businesses.subscription_status`; checkout leg at `payments_stripe.py:428`; gate at `auto_bidding.py` |
| Status | ✅ Built, ⚪ beta posture: everyone defaults to `trialing`, nobody has been billed |

This is the stream this document used to omit entirely. It **gates auto-bidding**, a paid feature by ruling (2026-07-24), and `payments_offplatform.py` states outright that the subscription *"is what monetizes"* cash and e-transfer bookings — the bookings the 10% never touches. That makes it structurally important, not a nice-to-have: without it, every off-platform booking is free to us.

> **Two hard constraints on writing about this.**
>
> 1. **Say nothing about monthly cost, anywhere, in either direction.** FACTS §8
>    holds the price open. *"No monthly fee"* is a banned claim (§2.2) precisely
>    because this stream exists.
> 2. **Do not advertise auto-bidding at all** — Kira's ruling, 2026-08-08. Not
>    pending a price: pending a client base, because the feature does nothing in
>    an empty marketplace. §4 closes the question.

---

### 3. Speculative — Boosted listings (post-MVP, month 2)

| Field | Value |
|---|---|
| Who pays | Business |
| When | Monthly subscription or per-boost |
| Amount | $29/month for "Featured" or $5/24h per boost |
| Status | ⚪ Not built |

A business pays to appear at the top of geo-browse results and post-and-match listings in their category + radius. Capped at 3 boosted slots per category per neighbourhood to keep the marketplace fair.

**Build target:** week 4 after launch.

---

### 4. Speculative — Verified Business badge

| Field | Value |
|---|---|
| Who pays | Business |
| When | Annual |
| Amount | $99/year |
| Status | 🚫 **Not built, and blocked from all public copy** |

The idea: manually verify business license, insurance, and at least one reference. A "Verified" badge appears next to the business name. Clients filter to "Verified only." Trust signal → higher conversion → businesses happy to pay.

It doubles as the **legal/insurance compliance layer** Swingbyy needs anyway, which is the strongest argument for it. Keep it on the roadmap.

> ### 🚫 This may not be mentioned in any public copy — §4
>
> **There is no verification flow.** `license_status` is a manual flag that most
> businesses have never had set. §4 bans claiming *any* badge, and the video
> pipeline crops the `✓ Verified` element out of every frame for exactly this
> reason.
>
> Pricing it in a strategy doc made it real downstream: `10-partnerships.md`
> offers it **free to Chamber of Commerce members**, `02-pricing.md` listed it as
> a launch perk, and `customer-story-template.md` put *"I knew the business was
> legit because of the verified badge"* in a customer's mouth. One unbuilt
> revenue line, four places committing us to ship it.
>
> If it gets built, it comes back with a section describing what it actually
> checks — and only then.

---

### 5. Speculative — Lead packs (alternative for low-volume businesses)

| Field | Value |
|---|---|
| Who pays | Business |
| When | Pre-paid |
| Amount | $50 for 10 leads / $200 for 50 leads |
| Status | ⚪ Not built (post-MVP) |

For businesses that don't want the 10% take rate, offer pre-paid lead packs. A "lead" = an introduction to a client who accepted their interest. Loses on revenue per transaction but wins on cash flow and reduces churn from price-sensitive solo operators.

**Build target:** month 3.

---

### 6. Future — Insurance & financial products

| Field | Value |
|---|---|
| Who pays | Business |
| Status | ⚪ Not built (year 2+) |

Once we hit 1,000+ active businesses, partner with an insurance broker to offer:
- Per-job liability insurance ($2-5/job, white-labeled, we take 20-30%)
- Tool/equipment coverage
- Instant pay (advance on escrow for a 1-2% fee)

These are **high-margin, high-stickiness** revenue streams. They're also the reason marketplaces like Uber, DoorDash, and Shopify all moved into financial services.

---

## What we do **not** charge for

- Client signup, search, booking, cancellation (within policy), messaging
- Business signup, profile creation, basic listing
- Reviews

**Why:** marketplace dynamics. We need ruthless adoption on both sides to get past liquidity. Anything that introduces friction on the client side dies. Anything that taxes a business before they've made money makes them churn.

---

## Unit economics target (post-launch month 3)

| Metric | Target |
|---|---|
| Avg booking value | $180 |
| Platform cut per booking | $18 |
| Bookings per active business per month | 4 |
| Revenue per active business per month | $72 |
| Active businesses | 250 |
| Monthly revenue | $18,000 |
| Boosted listings revenue (5% adoption) | ~$360 |
| **MRR target month 3** | **~$18,400** |

This is the floor, and it assumes a marketplace that does not exist yet — payments run in sandbox and there are no customers. The ceiling is several multiples higher if boosted-listing and subscription adoption reach 20-30%, but both of those need the features shipped and the subscription priced first.

---

## Why this model wins

1. **No money out of pocket for businesses to start** → low CAC, fast onboarding.
2. **Client pays nothing extra** → no acquisition friction on the demand side.
3. **Revenue scales with marketplace volume**, not headcount.
4. **Optional paid features** create a runway for ARPU expansion without raising the base take rate.
5. **Escrow + 10% cut is identical to Uber/Airbnb mental model** — businesses don't need to be educated.

---

## Risks

| Risk | Mitigation |
|---|---|
| Businesses bypass the platform after first job ("just text me directly next time") | Lock messaging to in-app until job completes; build review/repeat-booking value so going off-platform costs them visibility and trust signals |
| 10% is "too high" for some categories (e.g. high-ticket trades) | Tiered take rate by category — possibly 7% for >$1000 jobs, 12% for <$100 jobs (not implemented yet, revisit at 1k businesses) |
| Clients comparison-shop on Google/Kijiji | Compete on the payment mechanic (held until you approve, proof-of-work photos) and on budget privacy — **not** on "verified" or "reviews", neither of which we have (§4) |
| Stripe/PayPal processing fees eat into the 10% | Currently absorbed; at scale, evaluate Stripe Connect Custom for lower per-tx cost |

---

## Cross-links

- [02-pricing.md](02-pricing.md) — exact dollar amounts and tiers
- [08-kpis-and-metrics.md](08-kpis-and-metrics.md) — how we track this
- Backend implementation: `backend/app/api/interests.py` (booking creation), `backend/app/api/bookings.py` (escrow release)
