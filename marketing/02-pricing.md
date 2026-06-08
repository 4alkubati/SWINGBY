# 02 — Pricing

> Exact dollar amounts, tiers, and rationale.

---

## Client pricing

**Free. Forever.**

Clients pay the price the business quoted, nothing more. No service fee line item. No "convenience charge." No paid tiers. No subscriptions.

Why: marketplace demand-side friction is fatal. Free clients = liquidity.

---

## Business pricing — base

| Item                                | Price            | Notes                      |
| ----------------------------------- | ---------------- | -------------------------- |
| Signup                              | Free             |                            |
| Listing                             | Free             | One business = one listing |
| Geo-browse visibility               | Free             |                            |
| Post-and-match interest expressions | Free             | Unlimited                  |
| Messaging on confirmed bookings     | Free             |                            |
| **Transaction fee**                 | **10% of total** | Taken on completion        |
|                                     |                  |                            |

---

## Business pricing — paid add-ons (post-launch month 2+)

| Add-on                     | Price     | What you get                                                            |
| -------------------------- | --------- | ----------------------------------------------------------------------- |
| Featured listing (monthly) | $29/month | Top placement in your category + neighbourhood, max 3 featured per slot |
| Boost (per-use)            | $5 / 24h  | Same as above but one-shot                                              |
| Verified Business badge    | $99/year  | Manual verification of license, insurance, references. Filter target.   |
| Lead pack — Starter        | $50       | 10 lead intros, no 10% fee on those bookings                            |
| Lead pack — Growth         | $200      | 50 lead intros, no 10% fee                                              |

---

## Cancellation & dispute fees (already implemented in backend)

| Trigger | Penalty | Who pays |
|---|---|---|
| Client cancels >48h before scheduled date | 0% | — |
| Client cancels ≤48h before scheduled date | 25% of total | Client (paid to business) |
| Client no-show | 50% of total | Client (paid to business) |
| Business cancels >48h before | 0% | — |
| Business cancels ≤48h before | 25% of total | Business (refunded to client) |
| Business no-show | 50% of total + warning | Business |

Tracked in `cancellations` table. Code: `backend/app/api/bookings.py` cancel route.

---

## Launch pricing (first 90 days in Calgary)

To win the first 100 businesses, we offer **founder pricing**:

| Item | Standard | Launch (first 100 biz) |
|---|---|---|
| Transaction fee | 10% | **5% for 6 months** |
| Verified badge | $99/year | **Free for year 1** |
| Featured listing | $29/month | **First month free** |

This is the standard playbook for two-sided marketplaces: subsidize the supply side hard until demand is there. Then turn off subsidies and let acquired supply stay because demand exists.

**Founder-pricing terms:**
- "First 100 businesses" = first 100 with at least 1 completed booking, not 100 signups
- Auto-flips to standard pricing on the 6-month anniversary of their first booking
- Communicated clearly during onboarding (banner: "You're business #X of 100 — locked at 5% for 6 months")

---

## Stripe / payment processor costs (absorbed by SwingBy)

Stripe charges ~2.9% + 30¢ per successful charge. On a $180 average booking:
- Stripe fee: $5.52
- SwingBy gross take (10%): $18.00
- **SwingBy net per booking: ~$12.48**

This margin is fine but watch it. If average booking drops below $40, Stripe eats half our take.

---

## Refund policy

| Situation | Refund |
|---|---|
| Business no-show | 100% refund + 50% penalty to business (client gets a $X credit) |
| Job not completed as described | Disputed via in-app dispute flow → SwingBy support adjudicates within 72h |
| Client changes mind, business already started | No refund — escrow already released 50% |
| Both sides agree to cancel | Full refund minus Stripe fee |

Dispute flow code: `mobile/src/screens/DisputeFlowScreen.js` + backend dispute table (TODO: confirm endpoint exists).

---

## Why these prices

1. **5% launch / 10% standard** is the lowest credible take rate in this segment — beats Thumbtack effective rates and TaskRabbit's 15%.
2. **$29/month featured listing** is anchored to Yelp's $99-$300/month — we look like a steal.
3. **$99/year Verified** matches HomeStars / HomeAdvisor verification pricing — familiar to tradespeople.
4. **$5 single boost** is impulse-priced — under the "should I bother thinking about this" threshold.
5. **All paid features are optional** — no business is ever forced into them.

---

## Pricing changes — version history

| Date | Change | Reason |
|---|---|---|
| 2026-06-05 | Initial pricing set | Document baseline |
