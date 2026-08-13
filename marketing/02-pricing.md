# 02 — Pricing

> Exact dollar amounts, tiers, and rationale.

> ### ⚠️ Reconciled against [FACTS.md](FACTS.md) on 2026-08-12
>
> Four corrections, two of them material:
>
> 1. *"No paid tiers. No subscriptions."* — **false.** A business subscription
>    exists in code and gates auto-bidding (§2.2). The line was true of the
>    *client* side and got written as if it covered the whole product.
> 2. The refund table claimed *"escrow already released 50%"* — **the 50/50 claim
>    again**, a third instance in this folder after `MARKETING-PLAN.md` and
>    `04-positioning-and-messaging.md`. Nothing is ever released before approval.
> 3. The cancellation table stated the ladder **backwards** — see the block on it
>    below. This is the same error FACTS §5.1 records on the live Terms page.
> 4. The Verified Business badge was removed as a product (§4).
>
> **The subscription price is an open `NEEDS-FACT` (§8).** This document therefore
> states no monthly cost — neither a number nor a denial.

---

## Client pricing

**Free. Forever.**

Clients pay the price the business quoted, nothing more. No service fee line item. No "convenience charge."

Why: marketplace demand-side friction is fatal. Free clients = liquidity.

> Was: *"No paid tiers. No subscriptions."* That is true for clients and false as
> written — it reads as a whole-product claim, and §2.2 bans *"no subscription"*
> by name because `businesses.subscription_status` is real. Scoped to clients, it
> is fine; left ambiguous, it is the exact claim that had to be pulled.

---

## Business pricing — base

| Item                                | Price            | Notes                      |
| ----------------------------------- | ---------------- | -------------------------- |
| Signup                              | Free             |                            |
| Listing                             | Free             | One business = one listing |
| Geo-browse visibility               | Free             |                            |
| Post-and-match interest expressions | Free             | Unlimited                  |
| Messaging on quoted jobs + bookings | Free             | Opens once you quote a job |
| **Platform fee**                    | **10% of total** | Taken **at release**, not at capture |

> *"Taken on completion"* was wrong in a way that matters to a business reading
> this. Completion alone moves nothing. The cut comes out when the **client
> approves** and escrow is released (§2, changed 08-08) — and while the job is
> open, the full amount is held, not the amount minus our fee. A $190 booking
> reads **$190 held**, not $171. PR #112 fixed demo data that had it backwards.

### Business subscription — real, priced elsewhere

`businesses.subscription_status` is a live column with a Stripe checkout leg
(`payments_stripe.py:428`). It gates **auto-bidding**, a paid feature by ruling
(2026-07-24). In beta everyone defaults to `trialing`, so no business has been
billed yet.

> **The price lives in a Stripe price id, not in this repo.** FACTS §8 holds it
> open: *what is the business subscription priced at, and is it announced before
> the Oct 1–10 launch or held back?* Until that is answered, write **nothing**
> about monthly cost — not a number, not "no monthly fee."
>
> Separately: **do not advertise auto-bidding at all yet.** Kira's ruling,
> 2026-08-08 — not "until we have a price," but until there is a client base for
> it to act on. §4 records that this is a sequencing decision and closes the
> question.

---

## Business pricing — paid add-ons (SPECULATIVE — none of these are built)

| Add-on                     | Price     | What you get                                                            |
| -------------------------- | --------- | ----------------------------------------------------------------------- |
| Featured listing (monthly) | $29/month | Top placement in your category + neighbourhood, max 3 featured per slot |
| Boost (per-use)            | $5 / 24h  | Same as above but one-shot                                              |
| Lead pack — Starter        | $50       | 10 lead intros, no 10% fee on those bookings                            |
| Lead pack — Growth         | $200      | 50 lead intros, no 10% fee                                              |

> 🚫 **Verified Business badge ($99/year) — removed.** It sold "manual
> verification of license, insurance, references" as a product. That product does
> not exist: `license_status` is a manual flag most businesses have never had
> set, and §4 bans claiming any badge. Pricing it made it real to every reader of
> this file, including `10-partnerships.md`, which went on to offer it free to
> Chamber members.
>
> The four rows left are **plans, not offers.** Nothing above is built. Do not
> quote these prices to a business.

---

## Cancellation & dispute fees

> ### 🚫 DO NOT PUBLISH THIS LADDER — corrected 2026-08-12, and still blocked
>
> The table that was here **stated the ladder backwards** and invented a business
> penalty ladder that does not exist. It had the client paying a 25% penalty on
> the rung where the client is actually made whole, and it gave "Business cancels
> ≤48h → 25%" and "Business no-show → 50% + warning", neither of which is in the
> code. A business cancelling gets no penalty ladder at all.
>
> This is **the same error FACTS §5.1 records on the deployed Terms page at
> swingbyy.com** — which is what the client legally agreed to. Two copies of the
> same backwards ladder, in the two places it does the most damage.

**Authority: `escrow.compute_cancellation_split()`.** It matches
`mobile/src/screens/shared/TermsOfServiceScreen.js` verbatim; keep those two in
step, because that text is what the client agreed to.

| Who cancels | When | Client refund | Business keeps |
|---|---|---|---|
| Client | no date confirmed yet | 100% | 0% |
| Client | >48h before the date (`early`) | **100%** | **0%** |
| Client | ≤48h before (`late`) | 75% | 25% |
| Client | date already passed (`no_show`) | 50% | 50% |
| Business | any time | 100% | 0% |

**No platform cut is taken on a cancellation** — a retained penalty goes entirely
to the business.

> **Two reasons this stays unpublished even now that it is right.**
>
> 1. **§2.3 blocks it.** The live Terms page still says the old backwards
>    version. Publishing the correct ladder while the deployed Terms contradicts
>    it points people at a page that disagrees with the post. Unblocks when
>    `web/pre-launch` redeploys — which is stuck on the `CLOUDFLARE_API_TOKEN`
>    repo secret (§5.1).
> 2. **The "made whole" framing needs care.** FACTS §2.3 summarises this as *the
>    client is refunded 100% in every bucket… plus a goodwill credit on the last
>    two.* The cash refund on those two rungs is 75% and 50%; the rest arrives as
>    **credit**. §4 is explicit that credits **cannot be spent** — redemption is
>    gated off. So "you're always made whole" is not a claim we can make today.

Tracked in `cancellations` table. Code: `backend/app/api/bookings.py` cancel route.

---

## Launch pricing (first 90 days in Calgary)

To win the first 100 businesses, we offer **founder pricing**:

| Item | Standard | Launch (first 100 biz) |
|---|---|---|
| Platform fee | 10% | **5% for 6 months** |
| Featured listing | $29/month | **First month free** |

> The *"Verified badge — free for year 1"* row is gone with the badge itself. Note
> that the featured-listing row is also **speculative** — the feature is not built,
> so "first month free" is a promise about something that does not exist yet.

This is the standard playbook for two-sided marketplaces: subsidize the supply side hard until demand is there. Then turn off subsidies and let acquired supply stay because demand exists.

**Founder-pricing terms:**
- "First 100 businesses" = first 100 with at least 1 completed booking, not 100 signups
- Auto-flips to standard pricing on the 6-month anniversary of their first booking
- Communicated clearly during onboarding (banner: "You're business #X of 100 — locked at 5% for 6 months")

---

## Stripe / payment processor costs (absorbed by Swingbyy)

Stripe charges ~2.9% + 30¢ per successful charge. On a $180 average booking:
- Stripe fee: $5.52
- Swingbyy gross take (10%): $18.00
- **Swingbyy net per booking: ~$12.48**

This margin is fine but watch it. If average booking drops below $40, Stripe eats half our take.

---

## Refund policy

| Situation | Refund |
|---|---|
| Business cancels, any time | 100% refund to the client; the business keeps nothing |
| Job not completed as described | Disputed via in-app dispute flow → Swingbyy support adjudicates |
| Client changes mind after the date passed | 50% refund — see the ladder above |
| Both sides agree to cancel | Per the ladder above |

> **Corrected 2026-08-12.** The row *"Client changes mind, business already
> started → No refund — **escrow already released 50%**"* was the 50/50 claim in
> its third hiding place in this folder. **Escrow is never released early.** The
> full amount is held until the client approves (§2); "business already started"
> is not a ledger state and releases nothing.
>
> Also corrected: *"client gets a $X credit"* — §4, credits exist but **cannot be
> spent**, so a credit is not a remedy we can offer. And the *"within 72h"*
> adjudication promise was dropped: §4 bans time-based promises outright, because
> **there is no scheduler** — nothing in this deployment fires on a clock.

Dispute flow code: `mobile/src/screens/DisputeFlowScreen.js` + backend dispute table (TODO: confirm endpoint exists).

---

## Why these prices

1. **5% launch / 10% standard** is the lowest credible take rate in this segment — beats Thumbtack effective rates and TaskRabbit's 15%.
2. **$29/month featured listing** is anchored to Yelp's $99-$300/month — we look like a steal.
3. **$5 single boost** is impulse-priced — under the "should I bother thinking about this" threshold.
4. **The add-ons are optional** — but note that **auto-bidding is not an add-on, it is behind the subscription gate**, so "all paid features are optional" is only true if you don't want that feature.

---

## Pricing changes — version history

| Date | Change | Reason |
|---|---|---|
| 2026-06-05 | Initial pricing set | Document baseline |
| 2026-08-12 | Reconciled against FACTS.md | Removed the Verified badge (no verification flow exists), removed *"no subscriptions"* (§2.2), fixed the platform fee timing to **at release**, replaced the backwards cancellation ladder with `escrow.compute_cancellation_split`, and removed a third instance of the 50/50 release claim from the refund table |  <!-- lint-ok -->
