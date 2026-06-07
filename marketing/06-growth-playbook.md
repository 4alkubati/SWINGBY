# 06 — Growth Playbook

> Channel-by-channel acquisition playbook with budgets, timelines, and expected CAC.

---

## North Star

**Active businesses with at least one completed booking in the last 30 days.**

This is the single number that matters. Not signups. Not waitlist. Not impressions. Active, transacting businesses. Demand follows supply in a marketplace, so this is the leading indicator of everything.

---

## Channel mix — Month 1

| Channel | Time/$$ | Expected CAC (business) | Expected CAC (client) |
|---|---|---|---|
| Founder-led outbound (cold email, DM, coffee) | 20 hrs/wk | $0 (free) | n/a |
| Referrals (in-app code) | 0 hrs/wk after setup | $50 credit | $10 credit |
| Hyperlocal SEO (50 long-form pages) | 30 hrs total | $0 ongoing | $5–15 |
| Instagram + TikTok organic | 5 hrs/wk | n/a | $0 |
| Local press (1-time) | 5 hrs | $0 | $0 |
| Reddit / Facebook groups | 2 hrs/wk | $0 | $0 |
| **Paid ads** | **$0 in month 1** | n/a | n/a |

**Total budget month 1: $0 paid spend.** Pure founder hustle. This is the right move pre-product-market-fit — you need to learn, not buy.

---

## Channel mix — Month 2

| Channel | Budget | Goal |
|---|---|---|
| Google Ads — branded only | $300/mo | Don't lose searches for "swingby calgary" |
| Instagram + TikTok organic + 2 micro-influencer comps | $200 (gift cards/comp) | 50k impressions, 500 signups |
| Hyperlocal SEO continued | $0 | Pages start ranking for long-tail |
| Referrals | $500 budget (credits issued) | 30 new businesses, 200 new clients |
| Outbound continued | 10 hrs/wk | 30 more businesses |

**Total month 2: ~$1,000.** Still tiny by ad standards. We're not buying users; we're seeding loops.

---

## Channel mix — Month 3

| Channel | Budget | Goal |
|---|---|---|
| Google Ads — branded + 5 long-tail | $800/mo | "house cleaner Calgary," etc. |
| Meta Ads — interest-targeted in Calgary | $500/mo | Test creative, find winning angle |
| Influencer partnerships (paid) | $1,000 | 3 mid-tier Calgary lifestyle creators |
| SEO continued + 20 more pages | $0 ongoing | Rank top 3 for 10+ terms |
| Email drip campaign to waitlist + churn | $50 (Resend) | Reactivate 10% of churned users |

**Total month 3: ~$2,350.** Now we're spending — but only because we have data on what converts.

---

## Channel deep-dives

### Channel 1 — Founder-led outbound

The most underrated channel for a 0-100 marketplace. It does not scale. That's the point.

**Tactic:**
1. List 50 businesses on Google Maps in Beltline/Mission for each launch category.
2. For each, find owner's email (Hunter.io, Apollo, or just the contact form).
3. Write a personal 4-sentence email. Subject: "Calgary founder, 30s ask."
4. If no reply in 5 days, send a 2-sentence follow-up.
5. If reply, book a 15-min Zoom or coffee.
6. On the call, walk them through the app, sign them up live.

**Email template:**
> Hey [name],
> 
> I'm Amr — Calgary founder. I'm launching SwingBy in 2 weeks: it's a clean, escrow-protected way for clients to book local services. Think Uber meets Thumbtack, made for Calgary first.
> 
> I'm picking the first 100 businesses to launch with. You're on my shortlist for [neighbourhood]. We pay you in escrow, charge 5% (vs Thumbtack's lead fees), and you get featured for free for 6 months.
> 
> 15 min next week to walk you through it?
> 
> Amr

**Conversion benchmark:** 10-20% reply, 30-40% of replies convert. So 50 emails ≈ 5-10 sign-ups. Repeat weekly.

---

### Channel 2 — Referrals

A two-sided referral loop is the only acquisition channel that compounds.

**Mechanics:**

| Who refers | Who joins | Reward (referrer) | Reward (joiner) | Trigger |
|---|---|---|---|---|
| Business | Business | $50 credit | $50 credit + 0% take rate for 60 days | New biz completes 1st booking |
| Client | Client | $10 credit (cap $50/yr) | $10 off first booking | New client completes 1st booking |
| Business | Client | $5 credit | $5 off | New client books *anything* from that biz |

**Implementation needed in app:**
- Generate unique referral code per user (already partially in mobile screens)
- Track attribution server-side (referrals table — add if not exists)
- Auto-credit on trigger event
- "Share my code" screen with WhatsApp/SMS/email pre-filled

**Why this works:** existing businesses know other businesses (industry chat groups, supplier networks). One activated business → 2-3 referrals on average over 6 months.

---

### Channel 3 — Hyperlocal SEO

Long-tail location + category pages are slow-burning but high-ROI. By month 3, this should be 30-50% of client signups.

**Page structure (50 pages):**

5 categories × 10 neighbourhoods = 50 pages.

URL pattern: `/calgary/[neighbourhood]/[category]`
- `/calgary/beltline/house-cleaning`
- `/calgary/mission/handyman`
- `/calgary/kensington/dog-walking`

**Each page contains:**
- H1: "Best house cleaners in Beltline, Calgary"
- 200-word intro about the neighbourhood + category
- List of 3-5 actual SwingBy businesses (cards with reviews)
- "How it works" mini-section
- 5 FAQs (price range, how long it takes, what to ask)
- 500-1500 words total, written for humans not robots
- Schema.org `LocalBusiness` + `Service` JSON-LD
- Internal links to category page + neighbourhood page

**Templates already exist:** `web/pre-launch/src/pages/CategoryPage.jsx`, `CalgaryPage.jsx`. Just need content for each combo.

**Tools:** Ahrefs (free trial) or Google Keyword Planner to verify search volume per term. Target 50-500 searches/mo per page.

---

### Channel 4 — Instagram + TikTok organic

Calgary's local-business and "things to do in Calgary" Instagram/TikTok community is real and active. We can be part of it.

**Content pillars (rotate):**
1. **Customer wins** — before/after photos, quick reels of a job
2. **Founder POV** — what we're building, why, what just broke
3. **Behind-the-business** — meet a SwingBy business of the week
4. **Calgary-specific** — service spotlights by neighbourhood
5. **Education** — "How much should a house cleaning cost in Calgary?" etc.

**Cadence:**
- Instagram: 4 posts/wk, 8 stories/wk, 2 reels/wk
- TikTok: 3 videos/wk
- LinkedIn: 2 posts/wk (founder personal + company)
- Twitter/X: 5 posts/wk (low effort, mostly threads)

**Tools (full list in `11-n8n-social-workflow.md`):** Buffer or Make/n8n for cross-posting, Canva for graphics, CapCut for video.

---

### Channel 5 — Local press

One well-placed Calgary Herald or BetaKit article = 1000+ qualified signups in a day. Not a repeatable channel, but high-ROI when it hits.

**Targets (in priority order):**
1. **BetaKit** (Canadian tech press) — angle: Calgary tech, founder story
2. **Calgary Herald — business section** — angle: local entrepreneur solving Calgary problem
3. **Avenue Calgary** — angle: lifestyle, local services
4. **MobileSyrup** — angle: new Canadian app
5. **CTV Calgary** — angle: human interest, Calgary maker
6. **Sprouter / Communitech** — angle: ecosystem
7. **Calgary Economic Development** — angle: local job creation

**Pitch email template** in `marketing/press/pitch-template.md` (TODO).

---

### Channel 6 — Reddit + Facebook groups

Low effort, high upside if you don't overdo it. The rule: be a human, not a marketer.

**Subreddits to engage:**
- r/Calgary (1M+ members)
- r/CalgaryBusiness
- r/Entrepreneur
- r/SmallBusiness

**Facebook groups to engage:**
- "Calgary Buy & Sell"
- "Calgary Recommendations" (or similar — varies)
- Trade-specific: Calgary Cleaners United, Calgary Tradespeople, etc.

**Engagement rules:**
- Don't post links. Comment with value. Once in a while, mention SwingBy when *genuinely* relevant.
- Always disclose: "Full disclosure, I'm the founder."
- Don't crosspost spam. Don't astroturf with fake accounts.

---

### Channel 7 — Paid ads (Month 3+)

Hold off on paid until you have:
- Conversion data (signup → first booking) for at least 2 cohorts
- CAC < LTV/3 in at least 1 organic channel
- A working referral loop

**Then:**

**Google Ads breakdown:**

| Campaign | Spend/mo | Keywords | Goal |
|---|---|---|---|
| Branded | $200 | "swingby," "swingby calgary," "swingby app" | Defend the brand |
| Service intent (Calgary) | $400 | "house cleaner calgary," "handyman calgary," "find a cleaner near me" | Acquisition |
| Brand-comparison | $200 | "thumbtack calgary," "homestars alternative" | Steal competitor traffic |

**Meta Ads (Instagram + Facebook):**

| Campaign | Spend/mo | Audience | Creative |
|---|---|---|---|
| Calgary 25-55, homeowners | $300 | Custom location, life events | UGC video, before/after |
| Lookalike from converters | $200 | LAL 1% of paying clients | UGC video |

**Stop spending if:**
- CAC > $30 per client signup, or
- CAC > $200 per business signup with first booking

---

## Customer acquisition funnel — expected numbers

This is the funnel we're optimizing. Track each step in PostHog or Mixpanel.

**Client side:**

| Step | Conversion | Cumulative |
|---|---|---|
| Sees ad / lands on page | 100% | 100 |
| Signs up | 8% | 8 |
| Posts a job | 50% | 4 |
| Receives interest from biz | 90% | 3.6 |
| Accepts and books | 60% | 2.2 |
| Completes job | 95% | 2.1 |
| Leaves a review | 50% | 1.05 |
| Books a 2nd time within 90 days | 30% | 0.63 |

**Business side:**

| Step | Conversion | Cumulative |
|---|---|---|
| Sees outbound / referral / ad | 100% | 100 |
| Signs up | 15% | 15 |
| Completes profile | 70% | 10.5 |
| Expresses interest in first post | 60% | 6.3 |
| Wins first booking | 50% | 3.15 |
| Wins 4+ bookings in first 90 days (= "activated") | 60% | 1.9 |

**Lifetime value (LTV) targets:**
- Activated business: $1,200 in year 1 (60 bookings × $20 platform cut)
- Activated client: $36 in year 1 (3 bookings × $12 platform cut on $180 avg job)

LTV:CAC target ratio = 3:1 minimum. We can pay up to $400 to acquire an activated business and $12 to acquire an activated client.

---

## Cross-links

- [03-go-to-market.md](03-go-to-market.md) — the why, this doc is the how
- [07-content-calendar.md](07-content-calendar.md) — 90-day content plan
- [11-n8n-social-workflow.md](11-n8n-social-workflow.md) — automated social media pipeline
- [08-kpis-and-metrics.md](08-kpis-and-metrics.md) — what to track
