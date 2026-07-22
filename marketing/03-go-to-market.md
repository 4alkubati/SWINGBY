---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# 03 — Go-to-Market: Calgary Launch Playbook

> How we get from zero to 100 active businesses and 500 active clients in Calgary.

---

## The hard truth about marketplaces

Two-sided marketplaces fail because they try to attract both sides at once. **You can't.** Pick one side, saturate it in a small geography, then the other side comes for free.

For SwingBy: **supply first** (businesses), then demand (clients).

**Why:** A client who searches and finds nothing leaves and never comes back. A business who signs up and has no jobs yet... still has a free listing they aren't paying for. They tolerate it. They invite their own existing clients to book through the app to test it. Each business is its own demand-acquisition channel.

---

## The geographic strategy

**Launch in one Calgary neighbourhood. Saturate it. Then expand by ring.**

Pick the densest, most service-economy-heavy area first. Recommendation: **Beltline + Mission** (high density of contractors, cleaners, beauty, dog walkers, personal trainers).

Then expand outward by quadrant:
1. Inner SW (Beltline → Mission → Bankview → Killarney)
2. NW (Kensington → Bridgeland → Hillhurst)
3. SE (Inglewood → Ramsay → Erlton)
4. Then suburbs (Brentwood, Marlborough, McKenzie, etc.)

Don't expand to Edmonton or Vancouver until Calgary hits 500+ active businesses.

---

## Categories to launch with

Start with **5 categories**, not 50. Picking too many spreads the supply too thin and clients see an empty marketplace.

Recommended launch categories:
1. **House cleaning** (high frequency, recurring bookings, easy to verify)
2. **Handyman / small repairs** (high demand, broad appeal)
3. **Dog walking / pet sitting** (passion category — businesses are vocal advocates)
4. **Personal training** (high LTV per client)
5. **Lawn care / snow removal** (seasonal urgency drives signups)

**Why these 5:** all are services where clients already wish they had a better way to find someone trustworthy, all are services where the operator is a solo or small team (our ICP), and they hit four distinct demographics so word-of-mouth doesn't bottleneck.

---

## Phase 1 — Pre-launch (today → +14 days)

### Goals
- Waitlist: 200 businesses, 1000 clients
- Site live, app builds tested on TestFlight + internal Play Store
- 10 businesses pre-committed via direct outreach

### Actions

**Outbound (founder does this personally):**
1. List 50 businesses in launch categories from Google Maps + Instagram in Beltline/Mission. Cold email + Instagram DM each. Pitch: "Founder of SwingBy — Calgary-based marketplace launching in 2 weeks, free + 5% lifetime cap if you join now. 5-minute call?"
2. Target 10 commits. 20% close rate is realistic. If lower, the pitch is broken — fix it before scaling.

**Inbound:**
1. Waitlist page (web/pre-launch) — already built. Pin to top of personal LinkedIn + Instagram.
2. Post in r/Calgary, r/CalgaryBusiness, r/Entrepreneur ("launching this") — keep humble, not promotional.
3. Reach out to 3 Calgary podcasts and 2 local news (Calgary Herald, CTV Calgary).

**Product:**
1. Test mobile app end-to-end on real Android + iOS device. Critical.
2. Test web app end-to-end. Critical.
3. Confirm Supabase, Stripe (if implemented), backend production deploy is stable.

---

## Phase 2 — Soft launch (Day 14 → Day 30)

### Goals
- 50 active businesses (= signed up + verified + 1 completed booking)
- 200 active clients (= signed up + at least 1 booking attempted)
- 75 completed bookings
- Find 3 product-killing bugs and fix them before scaling

### Actions

**Invite-only launch:**
1. Personally onboard each of the 10 pre-committed businesses. Walk them through. Watch where they get stuck. This is the most valuable user research you'll ever do.
2. Each onboarded business gets a unique referral code. Give them $50 SwingBy credit + 0% take rate for 2 months for every other business they refer who completes a booking.
3. Personally fulfill the first 20 client bookings. Yes — call the client, walk them through, follow up after the job. Founder-led concierge. Doesn't scale; that's the point — this is how you learn.

**Communications:**
1. Daily standup with yourself: "What broke? What surprised me?"
2. Weekly user interview — 30 min with 3 businesses, 3 clients
3. Update the waitlist weekly with "we're up to X jobs / Y businesses" — social proof

---

## Phase 3 — Public launch (Day 30 → Day 90)

### Goals
- 250 active businesses
- 1500 active clients
- 1000 completed bookings
- MRR ~$18,000 (per `01-monetization-strategy.md`)

### Actions

**Channels (in order of priority):**

1. **Referrals** — both sides. Business refers business = $50 credit each. Client refers client = $10 credit each (capped at $50). Code: `mobile/src/screens/...` (TODO: build referral screen if not yet).
2. **Hyperlocal SEO** — `web/pre-launch/src/pages/CategoryPage.jsx`, `CityPage.jsx`, `CalgaryPage.jsx` already exist. Write 50 long-form pages: "Best house cleaners in Beltline Calgary," "Top-rated handymen in Mission Calgary," etc. Aim for ~1500 words each, real businesses listed.
3. **Local press** — pitch "Calgary entrepreneur launches Uber-for-services" to Calgary Herald, BetaKit, MobileSyrup. Press release in `marketing/press/` (TODO: write).
4. **Instagram + TikTok** — partner with 5 Calgary lifestyle micro-influencers (5-50k followers). Pay or comp services. Soft asks: "Show booking process," not "Read this script."
5. **Trade-specific Facebook groups** — Calgary Cleaners, Calgary Trades, Calgary Pet Services. Soft introduction by founder.
6. **Google Ads — branded only at first** — $500/mo cap. Target "SwingBy Calgary," "SwingBy app." No competitor bidding, no broad "house cleaner Calgary" until conversion economics are proven.

---

## What we explicitly are NOT doing

- ❌ Billboards
- ❌ Radio ads
- ❌ TV
- ❌ Conference booths
- ❌ Paid ads outside Canada
- ❌ Expanding to Edmonton/Vancouver in year 1
- ❌ Building 50 categories
- ❌ Spending more than $500/mo on paid acquisition in year 1
- ❌ Hiring before MRR $25k

**Why:** marketplaces are won by depth, not breadth. Saturation in one neighbourhood beats thin presence in 20 cities.

---

## Cross-links

- [05-launch-checklist.md](05-launch-checklist.md) — exact tasks for launch day
- [06-growth-playbook.md](06-growth-playbook.md) — channel-by-channel breakdown post-launch
- [08-kpis-and-metrics.md](08-kpis-and-metrics.md) — what to measure each week

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]

**Related:** [[01-monetization-strategy]] · [[05-launch-checklist]] · [[06-growth-playbook]] · [[08-kpis-and-metrics]]
<!-- graph-wire:end -->
