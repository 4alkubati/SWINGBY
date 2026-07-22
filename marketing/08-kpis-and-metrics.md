---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# 08 — KPIs & Metrics

> What to track, when, and what counts as "good."

---

## North Star metric

**Weekly Active Transacting Businesses (WATB)**

A business is counted if they had at least one completed booking in the trailing 7 days.

This is the marketplace's heartbeat. If this is growing, everything else follows. If this is flat or declining, nothing else matters.

| Month | WATB target |
|---|---|
| Month 1 | 25 |
| Month 2 | 100 |
| Month 3 | 250 |
| Month 6 | 600 |
| Month 12 | 1,500 |

---

## Top-line dashboard (review weekly)

| Metric | Definition | Target M3 | Where measured |
|---|---|---|---|
| WATB | See above | 250 | Backend query |
| Weekly active clients | Clients who booked or posted in last 7d | 800 | Backend query |
| Bookings completed | Jobs marked complete this week | 300/wk | Backend query |
| GMV (Gross Merchandise Value) | Total $ of completed bookings | $54,000/wk | Backend query |
| Revenue | Platform cut + paid features | $5,400/wk | Backend query |
| MRR | Recurring (Featured + Verified) | $1,500 | Backend query |
| Stripe payouts to businesses | $ released from escrow this week | $48,600/wk | Stripe dashboard |
| Net Promoter Score (NPS) | Avg of 0-10 "would you recommend" | 50+ | Email survey |

---

## Funnel metrics (review biweekly)

### Client funnel

| Step | Definition | Target | Action if below |
|---|---|---|---|
| Page → signup | % of visitors who create account | 8% | Improve hero/CTA |
| Signup → first post | % who post a job within 7d | 50% | Improve onboarding/empty state |
| Post → interest received | % of posts that get ≥1 interest within 24h | 90% | Need more supply (businesses) |
| Interest → accept | % of clients who accept an interest | 60% | Improve business profile quality |
| Accept → completion | % of bookings completed | 95% | Improve dispute/no-show handling |
| Completion → 2nd booking | % who book again in 90d | 30% | Reactivation email, recurring service push |

### Business funnel

| Step | Definition | Target | Action if below |
|---|---|---|---|
| Outreach → signup | % of cold leads who sign up | 15% | Better email copy |
| Signup → profile complete | % who add services + photos | 70% | Better onboarding |
| Profile → first interest | % who express interest in first 7d | 60% | Push notifications, education |
| Interest → first booking | % who win first booking in 30d | 50% | More supply density needed |
| First booking → activated (4 in 90d) | % who hit 4 bookings | 60% | Education on profile optimization, response time |

---

## Cohort metrics (review monthly)

Track every signup cohort by month.

### Day-30 retention (target)

| Cohort age | % still active |
|---|---|
| Day 1 | 100% |
| Day 7 | 60% |
| Day 14 | 40% |
| Day 30 | 25% |
| Day 60 | 18% |
| Day 90 | 15% |

Marketplace retention is harsh because some users have infrequent needs. Anything above 15% at day 90 is healthy.

### Repeat booking rate

| Cohort | Bookings/active client/year |
|---|---|
| Month 1 cohort | 4-6 bookings |
| Month 3 cohort | 3-5 |
| Month 6 cohort | 2-4 |

---

## Unit economics (review monthly)

| Metric | Definition | Target |
|---|---|---|
| Avg Booking Value (ABV) | Sum of booking $ / # bookings | $180 |
| Platform Take per Booking | ABV × 10% | $18 |
| Stripe fee per Booking | 2.9% + 30c on ABV | $5.52 |
| Net Take per Booking | Platform take − Stripe | $12.48 |
| CAC (per activated business) | Total marketing $ / activated biz | <$200 |
| CAC (per activated client) | Total marketing $ / activated client | <$15 |
| LTV (per activated business) | Sum of platform takes in 12mo | $1,200 |
| LTV (per activated client) | Sum of platform takes in 12mo | $36 |
| **LTV:CAC** | LTV / CAC | **≥3:1** |
| Payback period (business) | Months until CAC recovered | <4 months |
| Gross margin | (Revenue − Stripe fees − cloud costs) / Revenue | 70%+ |

---

## Quality metrics (review weekly)

A marketplace dies fast when quality slips. Track these even when growth looks great.

| Metric | Target | Action if below |
|---|---|---|
| % bookings with 5★ review | 70% | Review business quality; offboard low-rated |
| % bookings disputed | <3% | Investigate trends |
| Avg response time (business) | <2 hours | Push notification optimization |
| % posts that match within 24h | 80% | Supply density problem |
| Refund rate | <2% | Quality control on business onboarding |
| App crash rate | <1% | Sentry triage |
| Customer support response time | <4 hours | Hire support if MRR > $10k |

---

## Tools

| Need | Tool | Cost |
|---|---|---|
| Product analytics | PostHog (self-hosted free, cloud $0-50/mo) | $0-50 |
| Error monitoring | Sentry (already in `web/pre-launch/src/lib/sentry.js`) | Free → $26/mo |
| Web analytics | Plausible or Umami | $9-19/mo or self-host |
| Email metrics | Resend dashboard | Free |
| App store metrics | App Store Connect + Play Console | Free |
| BI / dashboards | Metabase on Supabase data | Free (self-host) |
| NPS surveys | Sprig or Hotjar | $0-49/mo |
| Heatmaps | Microsoft Clarity | Free |

**Total monthly tools cost target:** <$100 in year 1.

---

## Reporting cadence

| Cadence | Audience | Format |
|---|---|---|
| Daily | Founder | Slack/Telegram bot with WATB, bookings, errors |
| Weekly | Founder + advisors | 1-page email Friday afternoons |
| Monthly | Founder + investors (if any) | 2-page email + 30-min Loom |
| Quarterly | Public (blog) | Transparency post: numbers, learnings |

---

## What we do NOT track (intentionally)

- Vanity follower counts (followers ≠ revenue)
- Email list size (engagement % matters, not size)
- Impressions on social (clicks + signups matter)
- App store rating (until we have 100+ reviews — noise)
- Press mentions (rare = unreliable signal)

---

## Cross-links

- [01-monetization-strategy.md](01-monetization-strategy.md) — revenue model
- [11-n8n-social-workflow.md](11-n8n-social-workflow.md) — auto-logs social metrics into dashboard

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]

**Related:** [[01-monetization-strategy]] · [[11-n8n-social-workflow]]
<!-- graph-wire:end -->
