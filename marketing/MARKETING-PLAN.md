# SwingBy Marketing Plan

> Version 1.0 — June 2026. For sharing with investors, partners, and advisors.

---

## Executive Summary

SwingBy is a two-sided service marketplace for Calgary, connecting homeowners and renters with local service businesses — cleaning, handyman, dog walking, moving, and more. Clients post a job for free and receive bids from nearby businesses. SwingBy splits payment — half released on booking confirmation, the balance on completion. Businesses pay a 10% fee on completion — not on leads, not on bids, only on revenue they actually earn.

The backend API, database, authentication, booking flow, staged payment split, and messaging are built and running. Stripe is wired in sandbox only — no live card charges yet. The mobile app is in development. The web presence is launching.

The marketing opportunity is clear: Calgary's $2.8B+ annual home services market has no dominant digital-first marketplace. HomeStars and Thumbtack charge per lead, regardless of outcome. Kijiji is unstructured and unsafe. Word-of-mouth still drives most local service discovery — a behaviour we can replicate in-app with reviews, referrals, and trust signals that don't exist anywhere else locally.

This plan covers the go-to-market approach, customer acquisition on both sides of the marketplace, content and brand strategy, paid media plan, and 12-month milestones. The target is 250 active businesses and $18k MRR by end of month 3, with a path to $60k MRR and 600+ active businesses by month 6.

---

## The Market Opportunity

**Calgary's home services market:**
- Calgary has approximately 1.4 million residents and 540,000 households.
- Household spend on services (cleaning, home repair, landscaping, pet care, moving) averages $3,000-5,000 per year.
- Total addressable market in Calgary alone: $1.6B-2.7B annually.
- Serviceable addressable market (categories SwingBy launches in first): ~$400M.

**Why now:**
- Post-pandemic, demand for home services is permanently elevated.
- Gig economy supply — solo operators and small businesses — has grown substantially.
- Trust is broken: no-shows and poor quality are rampant on unstructured platforms.
- Digital-native booking is expected: Uber and Airbnb have set the standard.

**The gap:**
No platform in Calgary offers: staged, platform-held payments + verified reviews + instant matching + a local-first focus. SwingBy addresses all four.

---

## The Product

SwingBy is a two-sided marketplace with two discovery flows:

**Post and match:** A client posts a job with a budget and description. Businesses in the area express interest with a quoted price. The client reviews profiles and accepts the one they want. SwingBy creates the booking and splits the payment into a 50% release on confirmation and a 50% balance held for completion.

**Geo-browse:** A client browses businesses on a map, filtered by category and distance. They contact a business directly or book through their profile.

The booking flow continues: employee assigned → date confirmed → job done → payment released. Businesses receive 50% on booking confirmation and 50% (minus 10% platform fee) on completion. Messaging opens on the quote thread once a business has quoted a job, and carries over onto the booking — a business can never cold-contact a client it hasn't quoted, so there's no spam and no cold pitching.

The platform's core trust mechanism is staged payment. Half of the client's money releases to the business on booking confirmation so they can schedule the work, and the balance only on completion. If something goes wrong, the client opens a dispute and the SwingBy team reviews it and decides the refund. This is the feature that kills the "Kijiji risk" and makes clients willing to try an unfamiliar business.

> **Roadmap note:** CARD-21 proposes moving to a full hold-until-completion model (nothing released until the job is done). Copy describing that model is describing the *future* product, not what ships today.

---

## Positioning and Competitive Landscape

**Positioning:** The safe, fast, local way to book services in Calgary — no lead fees for businesses, no hidden fees for clients.

| Platform | Who pays | When they pay | Local to Calgary | Escrow | Verified reviews |
|---|---|---|---|---|---|
| SwingBy | Business only | On completion (10%) | Yes | Yes | Yes |
| Thumbtack | Business | Per lead ($15-50 regardless of outcome) | No | No | Limited |
| HomeStars | Business | Subscription + leads | No | No | Moderated |
| Kijiji Services | Neither | Never (classifieds) | No | No | None |
| TaskRabbit | Business | 15% of job | No | No | Yes |
| Word of mouth | Neither | Never | Yes | No | No |

SwingBy's differentiator is the combination of local focus + outcome-based pricing + platform-held payment. No lead fees means businesses have no risk in joining. Staged payment plus a dispute process means clients aren't handing a stranger the full amount up front. That's the unlock for both sides.

For full positioning detail: [04-positioning-and-messaging.md](04-positioning-and-messaging.md)

---

## Monetization Model

**Primary: 10% transaction fee on completed bookings.** Charged to the business, deducted from the final release on job completion. This is the core revenue stream.

**Secondary (month 2+):**
- Featured listing: $29/month or $5 per 24-hour boost
- Verified Business badge: $99/year (manual license and insurance verification)
- Lead packs: $50 for 10 leads or $200 for 50 leads (alternative to take rate for price-sensitive businesses)

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
All 8 planned channels running. SEO driving 30-50% of new client signups. Paid ads profitable (LTV:CAC ≥ 3:1). Verified badge and boosted listings live.

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
Property management companies (pre-negotiate a preferred provider deal), real estate agents (recommend SwingBy to new homebuyers), mortgage brokers, relocation services.

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
| 4 | Verified badge and boosted listings launched. Paid channels profitable. 400 businesses. |
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
SwingBy is not currently raising external capital. The product is self-funded through MVP. When the time comes, funding will accelerate:

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
