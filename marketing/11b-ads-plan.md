---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# 11b — Paid Ads Playbook

> Deeper than the growth playbook. Channel-by-channel structure, budgets, kill switches, and a week-by-week ramp from $0 to $3k/month.

---

## Overview

Do not run paid ads before month 2. Run paid ads when:
1. You have signup → first-booking conversion data from at least 2 organic cohorts.
2. Organic CAC is under $200 for businesses and $20 for clients.
3. You have at least 50 active businesses (the supply side).

Without supply, paid demand just churns. With supply, paid demand compounds.

---

## Month-by-month ad budget — Year 1

| Month | Total budget | Google Ads | Meta Ads | TikTok | Reddit | Notes |
|---|---|---|---|---|---|---|
| 1 | $0 | — | — | — | — | Organic only. Prove conversion. |
| 2 | $300 | $300 | — | — | — | Branded only. Defend brand search. |
| 3 | $1,000 | $600 | $400 | — | — | Add Meta test creative |
| 4 | $1,500 | $800 | $700 | — | — | Optimize winning Meta creative |
| 5 | $2,000 | $1,000 | $900 | $100 | — | Add TikTok test |
| 6 | $2,500 | $1,200 | $1,100 | $200 | — | Scale what's working |
| 7 | $2,800 | $1,300 | $1,200 | $200 | $100 | Reddit experiment |
| 8 | $3,000 | $1,400 | $1,300 | $200 | $100 | Full channel mix |
| 9 | $3,000 | $1,400 | $1,300 | $200 | $100 | Maintain if LTV:CAC ≥ 3:1 |
| 10 | $3,200 | $1,500 | $1,400 | $200 | $100 | Seasonal bump (fall = cleaning) |
| 11 | $3,500 | $1,600 | $1,600 | $200 | $100 | Holiday home prep (handyman) |
| 12 | $2,500 | $1,200 | $1,100 | $200 | $0 | January slow → pull back |

**Total year 1:** ~$25,300

---

## Week-by-week ramp ($0 to $3k/mo over 12 weeks)

| Week | Weekly budget | Channel | Goal |
|---|---|---|---|
| 1 | $0 | — | Build conversion baseline from organic |
| 2 | $0 | — | Same |
| 3 | $0 | — | Same |
| 4 | $50/wk | Google Branded | Don't lose brand searches |
| 5 | $75/wk | Google Branded | Bid up to top 3 position |
| 6 | $100/wk | Google Branded + 1 keyword | Add "house cleaner Calgary" |
| 7 | $150/wk | Google (2 campaigns) | Add service-intent campaign |
| 8 | $200/wk | Google + Meta test | First Meta creative test (3 ads) |
| 9 | $250/wk | Google + Meta | Kill lowest-performing Meta ad |
| 10 | $400/wk | Google + Meta | Double budget on winning Meta creative |
| 11 | $550/wk | Google + Meta | Add retargeting campaign |
| 12 | $700/wk | Full month $3k | All channels running |

---

## Google Ads campaign structure

### Campaign 1 — Branded

**Goal:** Own our brand name. Prevent competitors from bidding on "SwingBy."

| Field | Detail |
|---|---|
| Keywords | "swingby", "swingby app", "swingby calgary", "swingby services" |
| Match types | Exact + phrase |
| Negative keywords | None — brand campaign is narrow |
| Bid strategy | Target impression share: top of page |
| Daily budget | $10/day |
| Ad copy variant A | Headline 1: "SwingBy Calgary" / Headline 2: "Book Local Services Fast" / Headline 3: "Payment Protected — Try Free" |
| Ad copy variant B | Headline 1: "SwingBy — Local Services" / Headline 2: "Post a Job, Get Bids Fast" / Headline 3: "No Fees for Clients" |
| Landing page | swingbyy.com (home) |

**Expected CPC:** $0.30-0.80 (branded is cheap). **Expected monthly spend:** $100-150.

---

### Campaign 2 — Service-intent (Calgary)

**Goal:** Capture people actively searching for services in Calgary.

| Field | Detail |
|---|---|
| Keywords | "house cleaner calgary", "handyman calgary", "dog walker calgary", "moving company calgary", "plumber calgary", "snow removal calgary", "pet sitter calgary" |
| Match types | Phrase + broad match modifier |
| Negative keywords | "jobs", "hiring", "salary", "reddit", "free", "DIY", "course", "youtube" |
| Bid strategy | Maximize conversions (once you have 30+ conversions; else manual CPC) |
| Daily budget | $20-40/day |
| Ad copy variant A | Headline 1: "Find a [Service] in Calgary" / Headline 2: "Post Free, Get Bids Today" / Headline 3: "Half Held Till The Job's Done" |
| Ad copy variant B | Headline 1: "Calgary [Service] — Book in Minutes" / Headline 2: "Real Reviews. Local Pros." / Headline 3: "Free for Clients" |
| Landing page | `/calgary/[neighbourhood]/[category]` SEO pages — not the homepage |

**Expected CPC:** $1.50-4.00. **Expected monthly spend:** $400-600.

**Keyword expansion (month 4+):** Add long-tail variants per suburb once the core keywords are profitable — "house cleaner NW Calgary," "handyman Beltline," etc.

---

### Campaign 3 — Brand-comparison

**Goal:** Capture people evaluating our competitors.

| Field | Detail |
|---|---|
| Keywords | "homestars alternative", "thumbtack calgary", "taskrabbit calgary", "kijiji services calgary", "handy calgary" |
| Match types | Exact + phrase |
| Negative keywords | "login", "reviews" (brand-specific review searches) |
| Bid strategy | Manual CPC, aggressive — willing to pay up to $5 per click |
| Daily budget | $10/day |
| Ad copy variant A | Headline 1: "Better Than Thumbtack?" / Headline 2: "SwingBy: No Lead Fees" / Headline 3: "10% on revenue vs $50/lead" |
| Ad copy variant B | Headline 1: "Skip the Lead Fees" / Headline 2: "Pay 10% Only When You Win" / Headline 3: "SwingBy — Calgary's Own" |
| Landing page | A dedicated comparison landing page `/vs/thumbtack` |

**Expected CPC:** $2-5. **Expected monthly spend:** $100-200.

---

## Meta Ads campaign structure

### Campaign 1 — Calgary 25-55 homeowners (cold)

**Goal:** Reach people in Calgary who own or rent homes and need services.

**Audience definition:**
- Location: Calgary, AB, Canada (25km radius)
- Age: 25-55
- Interests: home improvement, home decor, real estate (homeowner signal)
- Exclude: people who already visited swingbyy.com (put them in retargeting)
- Budget: $10-15/day
- Objective: Conversions → signup event

**Creative direction:**
- UGC-style video: a client posting a job in 60 seconds and getting 3 bids
- Before/after photos: messy room → cleaned room
- Founder talking head: "I built this because I couldn't find a reliable cleaner in Calgary"

**Copy variant A:**
> "Post your job. Get bids. Pick the best. SwingBy handles payment — you get your money back if the job isn't done right. Free to use. Calgary only (for now)."

**Copy variant B:**
> "Finding a cleaner in Calgary shouldn't take 3 hours of Googling. SwingBy connects you with vetted local businesses in minutes. No hidden fees. Payment held and released in stages."

**Landing page:** swingbyy.com home with client CTA prominent.

---

### Campaign 2 — Lookalike from paying clients

**Objective:** Scale what's already working.

**Setup:** Upload a list of email addresses of clients who completed at least one booking to Meta → Create 1% lookalike audience (Canada). Run once you have 100+ customer emails.

**Budget:** $10-20/day  
**Creative:** Same as cold campaign, but test testimonial-style ads — real quotes from real users.

---

### Campaign 3 — Retargeting

**Audience:** People who visited swingbyy.com but did not sign up (pixel-based). Exclude people who already signed up.

**Budget:** $5/day  
**Creative:** Simpler, shorter. "You were on SwingBy. Still need a [cleaner/handyman]? 3 minutes to post your job."  
**Landing page:** Direct to signup page.

---

## TikTok Ads (Year 2)

**When to consider:** When organic TikTok posts are getting 50k+ views per week and you have budget to scale.

**Target audience:**
- Calgary area
- 18-35 renters and new homeowners
- Interest: home improvement, lifestyle

**Format:** In-Feed Video Ads — 15-30 seconds, shot vertically, same energy as organic TikTok.

**Content ideas:**
- "Watch me find a cleaner in 2 minutes" (screen recording + voiceover)
- "Calgary services that don't suck" (compilation of before/after)
- Founder walking through the app with voiceover

**Budget when starting:** $5-10/day ($150-300/month). TikTok CPMs are lower than Meta — but conversion rates are also lower because intent is lower.

**Kill switch:** If CPL (cost per lead/signup) > $25, pause and reassess creative.

---

## Reddit Ads (experimental)

**Why Reddit:** Calgary subreddits are active and locals ask for service recommendations regularly. A Reddit ad that feels like a real post can work. Most Reddit ads don't — because they feel like ads.

**Subreddits:**
- r/Calgary (1M+ members)
- r/CalgaryBusiness
- r/PersonalFinanceCanada (homeowners who care about value)

**Format:** Promoted post — looks exactly like a community post.

**Copy (must read like a human wrote it):**
> "For anyone who's been burned by no-shows or Kijiji people — we built a marketplace for Calgary where the payment sits with the platform and only half goes out until the job's done. Still in early days but wanted to share it with r/Calgary first."

**Budget:** $5-10/day. Cap at $300/month for experiment phase.

**Kill switch:** If CPM is > $10 or CTR is < 0.3%, pull it. Reddit ads work by surprise — if it feels like an ad, it fails.

---

## Tracking setup

### UTM convention

All paid ads must use UTMs. Convention:

```
?utm_source=[google|meta|tiktok|reddit]
&utm_medium=[cpc|paid-social|video]
&utm_campaign=[branded|service-intent|comparison|cold|retargeting|lookalike]
&utm_content=[ad-variant-id]
&utm_term=[keyword-optional]
```

Example:
```
https://swingbyy.com/?utm_source=google&utm_medium=cpc&utm_campaign=service-intent&utm_content=variant-b&utm_term=house-cleaner-calgary
```

Store UTM parameters in your analytics DB on signup. This tells you which ad led to which signup and eventually which booking.

### Conversion events to log in PostHog

| Event | When to fire | Notes |
|---|---|---|
| `page_view` | Every page load | Include UTM params |
| `signup_started` | Signup form opened | |
| `signup_completed` | Account created | |
| `first_post_created` | Client posts first job | |
| `first_booking_completed` | First booking marked done | This is activation for clients |
| `business_signup_completed` | Business profile completed | |
| `business_first_booking` | Business completes first booking | This is activation for businesses |

Fire these events to PostHog via the JS SDK. In PostHog, create funnels from `page_view → signup_completed → first_booking_completed` segmented by UTM source.

---

## Kill switches — CAC thresholds

Stop spending on a campaign if these thresholds are breached:

| Campaign | Kill switch trigger |
|---|---|
| Google Branded | CPC > $3 AND brand impression share < 70% → increase bid instead |
| Google Service-intent | CAC (client signup) > $25 OR CAC (client activation) > $80 |
| Google Brand-comparison | CTR < 2% → rewrite ad copy. CAC > $40 → pause |
| Meta Cold | CAC (client signup) > $30. CPM > $20 → creative fatigue, refresh |
| Meta Lookalike | CAC > $25. ROAS < 2:1 |
| Meta Retargeting | CAC > $20 (should be cheapest channel) |
| TikTok | CPL > $25. View rate < 15% → creative problem |
| Reddit | CTR < 0.3%. CPM > $10. CPC > $8 |

Review these weekly in the first 3 months. Monthly once stabilized.

---

## Tracking and reporting

Weekly ads review (15 minutes every Monday):
1. Open Google Ads and Meta Ads Manager side by side.
2. Compare CAC to kill switch thresholds.
3. Pause any ad set that has breached a threshold for 7+ consecutive days.
4. Increase budget by 20% on any campaign where CAC is below target and impressions are not exhausted.
5. Log findings in your weekly metrics email.

---

## Cross-links

- [06-growth-playbook.md](06-growth-playbook.md) — channel strategy and organic channels
- [08-kpis-and-metrics.md](08-kpis-and-metrics.md) — CAC and LTV targets
- [11c-customer-acquisition.md](11c-customer-acquisition.md) — how ads fit into the full acquisition strategy

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]

**Related:** [[06-growth-playbook]] · [[08-kpis-and-metrics]] · [[11c-customer-acquisition]]
<!-- graph-wire:end -->
