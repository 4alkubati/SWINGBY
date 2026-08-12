# Swingbyy Marketing Plan

> Version 1.1 — reconciled against [FACTS.md](FACTS.md) on 2026-08-12.
> For sharing with investors, partners, and advisors.

> ### ⚠️ Read before sharing this document
>
> Version 1.0 (June 2026) described a **50/50 staged payment split** — *"Half of
> the client's money releases to the business on booking confirmation… and the
> balance only on completion."* **The product has never worked that way.** That
> claim was killed in the app on 2026-07-29, in the store listing on 07-31, and
> again in PR #86 on 08-01 — and it was still sitting in this file, the one
> marked *for sharing with investors*, on 2026-08-12.
>
> Corrected below: the payment model (§2), the Verified badge revenue line (§4 —
> the verification gate does not exist), *"verified reviews"* as a differentiator
> (§4 — we have no reviews), and the subscription question (§2.2 — a business
> subscription is real, and its price is an open `NEEDS-FACT`, so this document
> now says nothing about monthly cost either way).
>
> **The forecasts in this document are targets, not results.** Nothing has
> launched, payments run in Stripe sandbox, and there are no customers. Anyone
> reading this should treat every number past "today" as a plan.

---

## Executive Summary

Swingbyy is a two-sided service marketplace for Calgary, connecting homeowners and renters with local service businesses — cleaning, handyman, dog walking, moving, and more. Clients post a job for free and receive quotes from nearby businesses. When the client accepts a quote, Swingbyy charges them and **holds the full amount** until the client approves the finished work. Businesses pay a 10% platform fee, taken at the moment the money is released to them — not on leads, not on bids.

The backend API, database, authentication, booking flow, escrow ledger, proof-of-work photos, and messaging are built and running. **Stripe is wired in sandbox only — no live card charges have ever been made.** The mobile app is built and in testing. The App Store listing goes live **Oct 1–10, 2026**; iOS reaches TestFlight before that.

The marketing opportunity is clear: Calgary's $2.8B+ annual home services market has no dominant digital-first marketplace. HomeStars and Thumbtack charge per lead, regardless of outcome. Kijiji is unstructured and unsafe. Word-of-mouth still drives most local service discovery — a behaviour we can replicate in-app with reviews, referrals, and trust signals that don't exist anywhere else locally.

This plan covers the go-to-market approach, customer acquisition on both sides of the marketplace, content and brand strategy, paid media plan, and 12-month milestones. The target is 250 active businesses and $18k MRR by end of month 3, with a path to $60k MRR and 600+ active businesses by month 6.

---

## The Market Opportunity

**Calgary's home services market:**
- Calgary has approximately 1.4 million residents and 540,000 households.
- Household spend on services (cleaning, home repair, landscaping, pet care, moving) averages $3,000-5,000 per year.
- Total addressable market in Calgary alone: $1.6B-2.7B annually.
- Serviceable addressable market (categories Swingbyy launches in first): ~$400M.

**Why now:**
- Post-pandemic, demand for home services is permanently elevated.
- Gig economy supply — solo operators and small businesses — has grown substantially.
- Trust is broken: no-shows and poor quality are rampant on unstructured platforms.
- Digital-native booking is expected: Uber and Airbnb have set the standard.

**The gap:**
No platform in Calgary offers platform-held payment released on the client's approval, combined with pre-acceptance privacy — the business prices the job from the work, the photos and the area, and never sees the client's budget. Swingbyy does both.

> Was: *"staged, platform-held payments + verified reviews + instant matching."*
> **Staged** is the 50/50 claim (§2). **Verified reviews** is §4 — we have no
> reviews and no verification flow. **Instant matching** promises a speed we have
> no data for. The privacy mechanic (§3.2) replaces them because it is real,
> enforced in the read path by `mask_service_post_row` (`privacy.py:133`), and
> genuinely unmatched locally.

---

## The Product

Swingbyy is a two-sided marketplace with two discovery flows:

**Post and match:** A client posts a job with a budget and description. Businesses in the area express interest with a quoted price. Crucially, they price it **without seeing the budget** — they get the work, the client's photos and the area, but not the name, the exact address, or the number the client had in mind. The client reviews profiles and accepts the one they want. Swingbyy charges the client at that moment, creates the booking, and holds the entire amount until the client approves the finished work.

**Geo-browse:** A client browses businesses on a map, filtered by category and distance. They contact a business directly or book through their profile.

The booking flow continues: employee assigned → date confirmed → work done → **client approves** → payment released. Businesses are paid, minus the 10% platform fee, once the client approves. If the client never responds, the booking settles to the business 24 hours after the business marked the work done. Messaging opens on the quote thread once a business has quoted a job, and carries over onto the booking — a business can never cold-contact a client it hasn't quoted, so there's no spam and no cold pitching.

The platform's core trust mechanism is that **the full amount is held until the client approves.** Nothing is released early. The business uploads before and after photos to the booking; the client reviews them and approves; only then does the money move. If something goes wrong, the client opens a dispute and the Swingbyy team reviews it and decides the refund. This is the feature that kills the "Kijiji risk" and makes clients willing to try an unfamiliar business.

> **Corrected 2026-08-12.** This paragraph used to read: *"The platform's core
> trust mechanism is staged payment. Half of the client's money releases to the
> business on booking confirmation so they can schedule the work, and the balance
> only on completion."* Every clause of that is false and always was —
> `escrow.compute_hold_cents` is `held = max(total - already_released, 0)`, and
> `partial_released` is marked in `escrow.py:12` as a legacy state kept only for
> back-compat. The stale CARD-21 note that used to sit here described
> hold-until-completion as a *future* model; it has been the shipped model
> throughout.
>
> Two precision points worth keeping straight, both from FACTS §2:
> - The 10% comes out **at release**, not at capture. A held booking holds the
>   whole charge — a $190 booking reads $190 held, not $171.
> - The 24-hour settlement is a **rule, not a timer.** There is no scheduler;
>   `settle_if_due` runs when the booking is read. Never write *"automatically
>   released after 24 hours."*

---

## Positioning and Competitive Landscape

**Positioning:** The local way to book services in Calgary — businesses are never charged per lead, and the client's payment is held until they approve the work.

| Platform | Who pays | When they pay | Local to Calgary | Payment held | Budget hidden from bidders |
|---|---|---|---|---|---|
| Swingbyy | Business | 10%, at release | Yes | Yes | **Yes** |
| Thumbtack | Business | Per lead ($15-50 regardless of outcome) | No | No | No |
| HomeStars | Business | Subscription + leads | No | No | No |
| Kijiji Services | Neither | Never (classifieds) | No | No | No |
| TaskRabbit | Business | 15% of job | No | No | No |
| Word of mouth | Neither | Never | Yes | No | No |

Swingbyy's differentiator is the combination of local focus + a fee that only lands on completed revenue + payment held until the client approves + **the bidder never seeing the client's budget**. No per-lead charge means businesses take no cash risk to quote. Held payment plus a dispute process means clients aren't handing a stranger the full amount up front.

> **The "Verified reviews" column was deleted, not answered.** We had ourselves
> marked "Yes" in it. We have no reviews and no verification flow (§4) — it was a
> column we lost on, scored as a win. The budget-privacy column replaces it
> because it is real (§3.2), enforced in code, and the one row where every
> competitor is genuinely "No".
>
> *"No lead fees"* was also softened to *"never charged per lead."* The original
> read as "businesses pay nothing but the 10%", and §2.2 is explicit that a
> business subscription exists and gates auto-bidding. See the monetization
> section for how that is now handled.

For full positioning detail: [04-positioning-and-messaging.md](04-positioning-and-messaging.md)

---

## Monetization Model

**Primary: 10% platform fee on on-platform bookings.** Charged to the business, deducted at the moment escrow is released to them. This is the core revenue stream and it is live in code (`escrow.PLATFORM_RATE`).

**Second, and already built: a business subscription.** `businesses.subscription_status` is a real column with a real Stripe checkout leg (`payments_stripe.py:428`), and it gates auto-bidding — a paid feature by ruling (2026-07-24). `payments_offplatform.py` states outright that the subscription *"is what monetizes"* cash and e-transfer bookings. During beta everyone defaults to `trialing`, so nobody has been billed; that is a beta posture, not a pricing decision.

> **The price is not set in this repo** — it lives in a Stripe price id. FACTS
> §8 carries it as an open question: *what is the business subscription priced
> at, and is it announced before the Oct 1–10 launch or held back?* Until that is
> answered, this document states neither a number nor a denial. Earlier versions
> claimed *"no monthly fee"*, which is false.

**Speculative (not built — do not sell these):**
- Featured listing: $29/month or $5 per 24-hour boost
- Lead packs: $50 for 10 leads or $200 for 50 leads

> 🚫 **The Verified Business badge ($99/year) has been removed as a revenue
> line.** It priced a manual license-and-insurance verification that **does not
> exist as a product**. `license_status` is a manual flag most businesses have
> never had set, and FACTS §4 bans claiming any badge. Selling it — or promising
> it free to a Chamber of Commerce, as `10-partnerships.md` does — commits us to
> shipping a verification gate nobody has built. If it gets built, it comes back
> with a section describing what it actually checks.

**Unit economics (Month 3 target):**
- Average booking value: $180
- Platform take per booking: $18
- Net take after Stripe fees: ~$12.48
- Active businesses: 250
- Bookings per business per month: 4
- Monthly revenue: ~$18,000

**Year 1 MRR trajectory:** $0 (month 1) → $5k (month 2) → $18k (month 3) → $35k (month 6) → $65k (month 12).

For full model: [01-monetization-strategy.md](01-monetization-strategy.md)
For pricing detail: [02-pricing.md](02-pricing.md)

---

## Go-to-Market Plan

**Launch sequence:**

**Month 1 — Beltline-only, 2 categories:**
Recruit 30-50 cleaning and handyman businesses in the Beltline neighbourhood through direct outreach. Manually facilitate the first 20 bookings. Fix every friction point. Do not run paid ads.

**Month 2 — Mission and Kensington, 3 categories:**
Add dog walking. Expand geography. Start Google Ads branded campaign ($300/month). Begin social media posting cadence. Referral program live.

**Month 3 — Calgary-wide, 5+ categories:**
All 50 neighbourhood/category SEO pages live. Meta Ads running ($400/month). Google service-intent campaigns running. Target: 250 active businesses, $18k MRR.

**Month 6 — Optimize and deepen:**
All 8 planned channels running. SEO driving 30-50% of new client signups. Paid ads profitable (LTV:CAC ≥ 3:1). Boosted listings live.

**Month 12 — Expand outside Calgary:**
If Calgary metrics are healthy (WATB 1,500+, LTV:CAC ≥ 3:1, NPS 50+), begin Edmonton expansion.

For the full plan: [03-go-to-market.md](03-go-to-market.md)

---

## Customer Acquisition

**The $10,000 answer** (how to deploy the first $10k in acquisition spend):
1. $0 — Founder direct outreach to 200 Calgary businesses (weeks 1-2)
2. $1,000 — Concierge the first 20 bookings manually
3. $1,500 — Referral credit program (funded credits)
4. $2,500 — Local press + 3 micro-influencer partnerships
5. $2,000 — Google Ads (branded + service-intent)
6. $2,000 — Meta Ads (once conversion data exists)
7. $1,000 — Content and social media infrastructure

**Business-side (supply) CAC targets:**
- Founder outbound: $0 cash cost
- Referrals: $50 credit cost
- Google Ads (service-intent): < $200
- Meta Ads: < $150

**Client-side (demand) CAC targets:**
- SEO: $5-15 long-term
- Google Ads: $15-25
- Meta Ads: $20-30
- Referrals: $10 credit cost

**Cold-start solution:**
- Concierge first 20 bookings manually before platform is fully automated
- Hyperlocal saturation: launch Beltline-only, get to 80% post-match rate before expanding
- Vertical-first: cleaning + handyman only in month 1

For the full acquisition deep dive: [11c-customer-acquisition.md](11c-customer-acquisition.md)

---

## Growth Channels

**Eight channels, in order of deployment:**

| Channel | Start | Best for | CAC |
|---|---|---|---|
| Founder outbound | Day 1 | Business acquisition | $0 |
| Referrals | Month 1 | Both sides | $10-50 credit |
| Hyperlocal SEO | Month 1 | Client acquisition | $5-15 (6mo+) |
| Organic social (IG, TikTok) | Month 1 | Brand awareness | $0 |
| Local press | Month 1 | Mass awareness (one-time) | $0 |
| Google Ads | Month 2 | High-intent client acquisition | $15-25 |
| Meta Ads | Month 3 | Awareness + retargeting | $20-35 |
| Reddit/community | Month 1-ongoing | Organic credibility | $0 |

The referral loop is the only channel that compounds with zero marginal cost. Prioritize it above all paid channels.

For the full growth playbook: [06-growth-playbook.md](06-growth-playbook.md)

---

## Brand and Content

**Brand voice:** Direct. Warm. Confident. Plain language. Short sentences. No startup buzzwords.

**Content strategy:** One blog post per week on long-tail Calgary service queries. Repurposed into 4 Instagram posts, 3 TikTok videos, 2 LinkedIn posts, 5 tweets, and 1 email. Total weekly time: 6 hours.

**Social automation:** Daily posting automated via n8n workflow. Content brief written in Notion → AI expands to platform-specific copy → Slack approval gate → auto-publish to all platforms. Analytics collected nightly.

**Content pillars:**
1. Customer wins (before/after, stories)
2. Founder POV (builds-in-public, honest)
3. Business spotlights (meet local providers)
4. Calgary-specific education ("how much does X cost in YYC?")
5. Product transparency (what we built, how it works)

For detailed brand standards: [09-brand-guidelines.md](09-brand-guidelines.md)
For the 90-day content calendar: [07-content-calendar.md](07-content-calendar.md)
For the social media operating manual: [12-social-media-playbook.md](12-social-media-playbook.md)

---

## KPIs and Milestones

**North Star Metric:** Weekly Active Transacting Businesses (WATB) — businesses with at least one completed booking in the trailing 7 days.

| Milestone | Target |
|---|---|
| WATB month 1 | 25 |
| WATB month 3 | 250 |
| WATB month 6 | 600 |
| WATB month 12 | 1,500 |
| MRR month 3 | $18,000 |
| MRR month 6 | $35,000 |
| MRR month 12 | $65,000 |
| Client LTV:CAC | ≥ 3:1 |
| Business LTV:CAC | ≥ 3:1 |
| NPS (month 6) | 50+ |
| % posts matched within 24h | 80% |
| % bookings with 5-star review | 70% |

**Key health metrics reviewed weekly:**
- WATB
- Bookings completed
- GMV
- Revenue
- CAC by channel
- Stripe payouts

For the full metrics framework: [08-kpis-and-metrics.md](08-kpis-and-metrics.md)

---

## Partnerships Strategy

**Three partnership tiers:**

**Tier 1 — Supply partners (add businesses):**
Trade associations (BOMA Calgary), Business Improvement Areas (Beltline BIA, Kensington BIA), trade supply companies, franchise networks. Goal: unlock 10-20 businesses per partnership, not one at a time.

**Tier 2 — Demand partners (add clients):**
Property management companies (pre-negotiate a preferred provider deal), real estate agents (recommend Swingbyy to new homebuyers), mortgage brokers, relocation services.

**Tier 3 — Credibility partners:**
Local press (BetaKit, Calgary Herald), Calgary Economic Development, University of Calgary entrepreneurship programs.

For the full partnerships strategy: [10-partnerships.md](10-partnerships.md)

---

## 12-Month Roadmap

| Month | Milestone |
|---|---|
| 1 | 30-50 businesses live in Beltline. 20+ completed bookings. Platform works end-to-end. |
| 2 | Expand to Mission + Kensington. Dog walking live. Google Ads branded. Referral program live. |
| 3 | 250 active businesses. All 50 SEO pages live. Meta Ads running. $18k MRR. |
| 4 | Boosted listings launched. Paid channels profitable. 400 businesses. |
| 5 | 500 businesses. Multiple categories. TikTok Ads test. $30k MRR. |
| 6 | 600 WATB. SEO driving 40%+ of client signups. NPS 50+. $35k MRR. |
| 7-9 | All channels optimized. Deepen Calgary penetration. Sub-$150 business CAC. $45-55k MRR. |
| 10-11 | Seasonal marketing (fall cleaning, winter prep). Push toward $60k MRR. |
| 12 | $65k MRR. 1,500 WATB. Begin Edmonton expansion planning. |

---

## Team and Ask

**Founder:** Amr Alkubati — Calgary. Built the full backend, database, and architecture. Product and technical lead.

<!-- HUMAN: replace with real team when ready -->
**Team:**
- Founder: Amr Alkubati — product, engineering, operations
- Advisors: TBD
- Planned hires: Marketing lead (Q4 2026), Customer success (Q1 2027), second engineer (Q1 2027)

**What the next [X] months of funding enables:**
<!-- HUMAN: replace with actual raise details when decided -->
Swingbyy is not currently raising external capital. The product is self-funded through MVP. When the time comes, funding will accelerate:

| Use of funds | Allocation |
|---|---|
| Marketing & paid acquisition (Calgary) | ~40% |
| Engineering (mobile app, full-time hire) | ~35% |
| Operations & customer success | ~15% |
| Legal, compliance, admin | ~10% |

> TODO (HUMAN): Fill in exact raise amount, valuation, and investor type (angels, pre-seed VC, etc.) when fundraising begins.

---

## Cross-links (full document index)

| Document | Topic |
|---|---|
| [01-monetization-strategy.md](01-monetization-strategy.md) | Revenue model and unit economics |
| [02-pricing.md](02-pricing.md) | Exact pricing tiers |
| [03-go-to-market.md](03-go-to-market.md) | Launch plan |
| [04-positioning-and-messaging.md](04-positioning-and-messaging.md) | Brand positioning and competitive framing |
| [05-launch-checklist.md](05-launch-checklist.md) | Pre-launch readiness checklist |
| [06-growth-playbook.md](06-growth-playbook.md) | Channel-by-channel growth plan |
| [07-content-calendar.md](07-content-calendar.md) | 90-day content plan |
| [08-kpis-and-metrics.md](08-kpis-and-metrics.md) | Metrics framework |
| [09-brand-guidelines.md](09-brand-guidelines.md) | Brand voice, visuals |
| [10-partnerships.md](10-partnerships.md) | Partnership strategy |
| [11-n8n-social-workflow.md](11-n8n-social-workflow.md) | Social media automation |
| [11b-ads-plan.md](11b-ads-plan.md) | Paid advertising playbook |
| [11c-customer-acquisition.md](11c-customer-acquisition.md) | Full acquisition strategy |
| [12-social-media-playbook.md](12-social-media-playbook.md) | Social media operating manual |
