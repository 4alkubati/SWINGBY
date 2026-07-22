---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# 01 — Monetization Strategy

> How SwingBy makes money.

---

## TL;DR

SwingBy charges a **10% platform fee** on every completed booking, taken from the business side (not the client). On top of that, businesses can pay for **optional growth features** (boosted listings, verified badge, lead-pack subscriptions). Clients are free, forever.

This is a **classic two-sided marketplace take-rate model** — similar to Thumbtack, TaskRabbit, Uber. The fee is invisible to the client and baked into the quoted price the business shows.

---

## Revenue streams

### 1. Primary — Transaction fee (the marketplace take rate)

| Field | Value |
|---|---|
| Who pays | Business |
| When | On job completion (escrow release) |
| Amount | **10% of total booking price** |
| Where it lives in code | `backend/app/api/interests.py` → on accept, payment row created with `platform_cut = 0.10 * total` |
| Status | ✅ Implemented |

**Why 10%:**
- Thumbtack charges $5-50 per lead (lead-gen model, no transaction fee). Take-rate equivalent is often 15-30%.
- TaskRabbit takes 15% from taskers.
- Uber takes 20-30%.
- Airbnb takes ~3% from hosts + 14% from guests (~17% total).
- 10% is **the lowest credible take rate in our segment**. We win businesses over by being clearly cheaper.

**When to revisit:** if business CAC < $50 and business LTV > $500, hold at 10%. If LTV-to-CAC ratio drops below 3:1, consider 12% on premium categories.

---

### 2. Secondary — Boosted listings (post-MVP, month 2)

| Field | Value |
|---|---|
| Who pays | Business |
| When | Monthly subscription or per-boost |
| Amount | $29/month for "Featured" or $5/24h per boost |
| Status | ⚪ Not built |

A business pays to appear at the top of geo-browse results and post-and-match listings in their category + radius. Capped at 3 boosted slots per category per neighbourhood to keep the marketplace fair.

**Build target:** week 4 after launch.

---

### 3. Secondary — Verified Business badge

| Field | Value |
|---|---|
| Who pays | Business |
| When | Annual |
| Amount | $99/year |
| Status | ⚪ Not built |

We manually verify business license, insurance, and at least one reference. A "Verified" badge appears next to the business name. Clients can filter to "Verified only." Trust signal → higher conversion → businesses happy to pay.

This also doubles as the **legal/insurance compliance layer** SwingBy needs anyway. We're charging for work we have to do.

**Build target:** week 6 after launch.

---

### 4. Tertiary — Lead packs (alternative for low-volume businesses)

| Field | Value |
|---|---|
| Who pays | Business |
| When | Pre-paid |
| Amount | $50 for 10 leads / $200 for 50 leads |
| Status | ⚪ Not built (post-MVP) |

For businesses that don't want the 10% take rate, offer pre-paid lead packs. A "lead" = an introduction to a client who accepted their interest. Loses on revenue per transaction but wins on cash flow and reduces churn from price-sensitive solo operators.

**Build target:** month 3.

---

### 5. Future — Insurance & financial products

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

This is the floor. The ceiling is several multiples higher if Verified + boosted adoption hits 20-30%.

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
| Clients comparison-shop on Google/Kijiji | Compete on trust (verified, escrow, reviews), not on price |
| Stripe/PayPal processing fees eat into the 10% | Currently absorbed; at scale, evaluate Stripe Connect Custom for lower per-tx cost |

---

## Cross-links

- [02-pricing.md](02-pricing.md) — exact dollar amounts and tiers
- [08-kpis-and-metrics.md](08-kpis-and-metrics.md) — how we track this
- Backend implementation: `backend/app/api/interests.py` (booking creation), `backend/app/api/bookings.py` (escrow release)

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]

**Related:** [[02-pricing]] · [[08-kpis-and-metrics]]
<!-- graph-wire:end -->
