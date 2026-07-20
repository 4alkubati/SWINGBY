# 11c — Customer Acquisition Deep Dive

> Both sides of the marketplace. Cold start to scale.

---

## If I had $10,000 to spend

Spend it in this order:

1. **$0** — Founder outbound: personally call or email 200 Calgary businesses in the 5 launch categories. Do it yourself. Take 2 weeks. Get 30-40 businesses live. This costs nothing and you learn more than any ad campaign.
2. **$1,000** — Concierge the first 20 bookings. Manually match clients to businesses. Call both sides. Be the marketplace. Fix every problem yourself. You will find the real friction.
3. **$1,500** — Referral credits. Set the referral loop ($50 for business referrals, $10 for client referrals). Pre-fund $1,500 in credits. One activated business refers 2-3 more on average.
4. **$2,500** — Local press and micro-influencers. Get one BetaKit article. Partner with 3 Calgary lifestyle creators for a comp post.
5. **$2,000** — Google Ads — branded + 3 service-intent keywords. Not before month 2.
6. **$2,000** — Meta Ads — one winning creative × 3 audiences. Not before you have conversion data.
7. **$1,000** — Buffer/n8n setup and first 3 months of content. Set the social flywheel early.

That's $10,000. By the time you've spent it, you should have 100+ active businesses, 500+ clients, and $15-20k MRR.

---

## Business-side acquisition (supply)

Supply is the hard side. Solve supply first.

### Outbound — direct

The fastest way to get businesses. Not scalable. That's fine.

**Step 1 — Build the list.**
Use Google Maps to find businesses in your 5 launch categories in Beltline, Mission, Kensington, Inglewood, and Downtown. Pull owner names from their websites. Aim for 50 businesses per category = 250 contacts.

**Step 2 — Segment by readiness.**
- Tier A: Solo operators (house cleaners, handymen, dog walkers) — most likely to adopt fast. No employees to convince.
- Tier B: Small businesses (2-5 people) — need to convince the owner and have a quick onboarding.
- Tier C: Established companies — slower to move, but high credibility signal.

Start with Tier A.

**Step 3 — Email script (personalized).**

> Subject: "Calgary founder — quick intro"
>
> Hey [first name],
>
> I'm Amr — I built SwingBy, a platform that sends you client leads in Calgary with the payment already committed on the platform. You quote, they accept, and 50% lands with you right away — the rest on completion. No chasing invoices.
>
> You'd be one of the first [category] businesses in [neighbourhood]. First 100 businesses are at 5% (instead of 10%) for 6 months.
>
> 15 minutes this week?
>
> Amr

**Conversion benchmark:** 10-15% reply rate, 30-40% of replies lead to a call. 50 emails = 5-10 sign-ups.

**Follow-up at day 5 (if no reply):**

> "Following up — still have a [neighbourhood] spot open if you're interested. Two-line reply is fine."

**Step 4 — Call, not email.**
If the business has a phone number visible, call instead of email. Conversion rate is 3× higher. Script: "Hi, I'm Amr — I built a platform for local services in Calgary and I'd love to feature [business name]. Do you have 3 minutes?"

---

### Referral mechanics — business side

A business referral program is the only acquisition channel that scales with zero marginal cost.

**How it works:**
- Every business gets a unique referral link (e.g., `swingbyy.com/ref/[code]`)
- When a referred business completes their first booking, both sides get a reward
- Referrer gets: $50 account credit (applied to platform fee)
- New business gets: 0% platform fee for their first 60 days

**Why this works:** Business owners know other business owners. Cleaning company owners know other cleaners, other tradespeople, other solo operators. Word spreads through trade communities fast.

**Where to promote the referral link:**
- Post-signup onboarding screen: "Know another [category] in Calgary? Share your link."
- After every completed booking: "Enjoying SwingBy? Refer a business, get $50."
- Email at day 14 and day 30 of business lifecycle.

---

### Partnerships — supply

| Partner type | What they unlock | How to approach |
|---|---|---|
| Trade associations (BOMA Calgary, CAMA) | Access to member business lists | Speak at one meeting. Offer free onboarding session. |
| Business improvement areas (Beltline BIA, Kensington BIA) | Credibility + member emails | Partner announcement: SwingBy recommended by BIA |
| Supplier networks (cleaning supply companies, tool rental) | Warm intros to their clients | Co-marketing: "Your clients can now get more jobs via SwingBy" |
| Franchise groups (cleaning, pest control) | Multiple units in one deal | Present to the franchisee group lead |
| Facebook trade groups | Organic reach to target audience | Join as founder, add value, mention SwingBy when relevant |

See [10-partnerships.md](10-partnerships.md) for full partnership strategy.

---

### Paid ads — business side

Hold off on paid acquisition for businesses until month 3. Use the budget for client acquisition first. Once you have supply density, use these to grow supply in specific underserved categories.

**Google Ads targeting for businesses:**
- Keyword: "how to get more clients [category]", "find clients as a [category] Calgary"
- Landing page: A dedicated "Grow your business" page at swingbyy.com/for-businesses
- Copy: "Stop paying $40/lead on HomeStars. SwingBy charges 10% only when you win the job."

**CAC target for business:** < $200 including all paid and owned channel costs.

---

## Client-side acquisition (demand)

Demand follows supply. Once you have 100 businesses live in a neighbourhood, client acquisition becomes much easier because the experience actually works.

### SEO — highest long-term ROI

By month 6, SEO should account for 30-50% of all client signups.

**Page structure:** 5 categories × 10 neighbourhoods = 50 pages.

Each page targets a query like "house cleaner Beltline Calgary" (100-500 searches/month).

**Content formula per page:**
- H1: "Best [category] in [neighbourhood], Calgary"
- 200-word intro (neighbourhood + service context)
- 3-5 real SwingBy businesses with names, photos, ratings
- "How it works" section (3 steps)
- 5 FAQs (price range, what to expect, how to book, cancellation, reviews)
- Schema.org LocalBusiness + Service markup
- Internal link to category page and city page

**Timeline:** Write 10 pages in week 1 of launch. Add 5 pages per week. By week 8, all 50 pages exist. By month 4, they start ranking.

**Tools:** Google Keyword Planner (free) to verify search volume. Google Search Console to track rankings.

---

### Referral mechanics — client side

| Who refers | Who joins | Referrer reward | New client reward | Trigger |
|---|---|---|---|---|
| Client | Client | $10 account credit | $10 off first booking | New client completes first booking |
| Business | Client | $5 credit | $5 off any booking from that business | New client books from that business |

**Where to promote:**
- Post-booking confirmation screen: "Love the experience? Share your link."
- Post-booking email: "Here's $10 for your next booking if you bring a friend."
- After a 5-star review is left.

---

### Paid client acquisition

Follow the ads plan in [11b-ads-plan.md](11b-ads-plan.md).

**CAC target for clients:** < $15 through organic channels, < $30 through paid.

**LTV target:** $36/year from a typical client (3 bookings × $12 net revenue per booking). This means paid CAC above $12 is technically unprofitable on year 1. Justify paid client acquisition with:
1. Repeat booking rate (every additional booking is near-zero marginal cost)
2. Network effects (each active client makes supply more valuable)
3. LTV grows as clients use more categories (one client might book cleaning, then handyman, then dog walking)

---

## The cold-start problem

Every two-sided marketplace has the cold-start problem: businesses don't join without clients, clients don't join without businesses.

**The solution for SwingBy:**

### Tactic 1 — Concierge the first 20 bookings

Before the platform is fully working, be the platform.

1. Manually recruit 10-15 businesses in 2-3 categories in one neighbourhood.
2. Manually recruit 20 clients (friends, family, community).
3. Match them yourself. Call both parties. Facilitate payment manually (e-transfer is fine for the first week).
4. Learn every friction point.
5. When you can do 20 bookings without touching anything, the platform is ready for public launch.

### Tactic 2 — Hyperlocal saturation

Do not launch across all of Calgary. Launch in one neighbourhood.

**Target: Beltline** — dense, urban, full of renters who need services, high concentration of solo operators.

Saturate Beltline:
- Every small cleaning business, handyman, dog walker in Beltline is signed up.
- Flyering in Beltline apartment buildings advertising the app.
- Facebook and Nextdoor posts for Beltline.
- Google Ads geo-targeted to Beltline.
- Tell every client "we're Beltline-focused right now but expanding soon."

Once Beltline is working (80%+ of posts get at least 2 interests within 24h), open Mission. Then Kensington.

### Tactic 3 — Vertical-first launch

Start with 2 categories maximum: house cleaning and handyman. These are:
- High frequency (clients book 6-12 times per year)
- High supply density in Calgary
- Easy to explain and market

Do not launch with 15 categories on day 1. You will spread supply too thin. A marketplace with 30 cleaners in Beltline is better than one with 2 cleaners in every category across the city.

Add dog walking in month 2. Add moving in month 3. Add pet sitting in month 4.

---

## Activation playbook

A signup is not activation. Activation is the first completed booking.

### Client activation — first 7 days

| Day | Action |
|---|---|
| Day 0 | Welcome email: "Here's how SwingBy works" (3-step visual) |
| Day 0 | Push notification: "Post your first job — it takes 60 seconds" |
| Day 1 | In-app nudge: empty state screen shows 3 nearby businesses in their area |
| Day 2 | Email: "Here's what to say in your post" (template) |
| Day 5 | Email: "3 businesses in your area are looking for work this week" |
| Day 7 | Push notification: "Your first job post is free" (if no post yet) |

**Goal:** 50% of signups post a job within 7 days.

### Business activation — first 7 days

| Day | Action |
|---|---|
| Day 0 | Welcome email: "Complete your profile to start getting leads" |
| Day 0 | In-app checklist: Add photo, add description, set service radius |
| Day 1 | Push notification: "2 new jobs posted near you — express interest now" |
| Day 2 | Email: "How to write a winning interest expression" |
| Day 3 | Call from founder (for first 50 businesses): "How's it going?" |
| Day 5 | Push notification: "You have 0 interests sent. Clients are waiting." |
| Day 7 | Email: "Business tip: businesses who respond in under 2h win 3× more jobs" |

**Goal:** 60% of signed-up businesses express interest in at least one post within 7 days.

---

## Reactivation playbook

### Clients who signed up but never booked

| Trigger | Action |
|---|---|
| Day 14, no booking | Email: "Still looking for a [service]? 3 businesses near you" |
| Day 30, no booking | Email: "Here's $10 off your first booking" |
| Day 45, no booking | SMS or push: "One tap to post your job" |
| Day 60, no booking | Remove from active marketing — dormant segment |

**Target reactivation rate:** 10-15% of dormant users.

### Clients who completed one booking but didn't return

| Trigger | Action |
|---|---|
| 60 days after last booking | Email: "Time for another clean?" (for cleaning category) |
| 90 days after last booking | Email: "How's [business name] working out?" + "Book again in 1 tap" |
| 90 days + a seasonal hook | Push: "Calgary winter's here — is your furnace ready?" (for handyman) |

**Target repeat booking rate:** 30% book a second time within 90 days.

### Businesses who signed up but never expressed interest

| Trigger | Action |
|---|---|
| Day 7, no interests | Push: "2 clients posted jobs in your category today" |
| Day 14, no interests | Email: "Let us walk you through it — 5-minute Zoom?" |
| Day 30, no interests | Email: "Your profile is live but we haven't seen you — are you still interested?" |
| Day 45, no interests | Founder call (for high-value categories) |

---

## Channel benchmark CACs and LTV targets

| Channel | Business CAC | Client CAC | Notes |
|---|---|---|---|
| Founder outbound | $0 (time only) | n/a | Not scalable past month 3 |
| Referrals | $50 (credit) | $10 (credit) | Best ROI of any channel |
| SEO | $0 ongoing | $5-15 | Slow to start, compounds |
| Google Ads (branded) | n/a | $8-15 | Protect brand, low volume |
| Google Ads (service-intent) | n/a | $15-25 | High intent, converts well |
| Meta Ads (cold) | $100-150 | $20-35 | Test-and-scale |
| Meta Ads (retargeting) | n/a | $8-15 | Cheapest paid channel |
| TikTok | n/a | $20-40 | High volume, lower intent |
| Reddit | n/a | $15-30 | Experimental |
| Local press | $0 | $0 | Unreliable but high when hits |
| Influencer | $50-200 | $10-30 | Per partnership |

**LTV targets** (from [08-kpis-and-metrics.md](08-kpis-and-metrics.md)):
- Activated business LTV year 1: $1,200
- Activated client LTV year 1: $36

**LTV:CAC ratio target:** ≥ 3:1 on every channel. If a channel's CAC is > LTV/3, pause and fix before scaling.

---

## Cross-links

- [06-growth-playbook.md](06-growth-playbook.md) — channel summaries
- [11b-ads-plan.md](11b-ads-plan.md) — detailed paid ads structure
- [08-kpis-and-metrics.md](08-kpis-and-metrics.md) — CAC and LTV targets
- [10-partnerships.md](10-partnerships.md) — partnership strategy for supply acquisition
- [03-go-to-market.md](03-go-to-market.md) — launch sequencing
