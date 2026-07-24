# Decision 33 — Calgary supply seeding (GAP-AUDIT #33)

> STRATEGY lane, 2026-07-23. Executable day-one plan for the first 25–50 real Calgary
> businesses, one founder. Calgary-specific, honest about what won't work.

## Recommendation in one line

Go **narrow and deep**: **house/office cleaning + handyman first**, hand-recruited by the
founder (email + phone, not ads), pitched as *free warm leads with the money already committed*,
sweetened with the **founder 5%-for-6-months** offer that already exists — 4 weeks, ~40
targeted outreaches a week, realistic yield 25–40 signups and 10–15 genuinely active.

## Which categories, and why (density + repeat-purchase, not market size)

The current seed spread is 8 categories across 18 businesses (verified in DB) — that is the
mistake the marketing doc itself warns against ("30 cleaners in Beltline beats 2 cleaners in
every category"). Pick on two axes that actually predict a working marketplace:

1. **Repeat-purchase rate** — how often the same client buys again (retention = the flywheel).
2. **Supply density** — how many interchangeable providers exist in a small area (so a client
   posting a job gets 2–3 quotes fast, which is the entire product promise).

| Category | Repeat rate | Density in Calgary | Verdict |
|---|---|---|---|
| **Residential cleaning** | **High** (bi-weekly/monthly recurring) | **Very high** (hundreds of solo cleaners + small crews) | **Start here.** Recurring demand seeds repeat bookings early; dense supply means fast quotes. |
| **Handyman / small repairs** | Medium (irregular but frequent) | High | **Start here.** Broad demand, low job value = low-risk first booking for a nervous client. |
| Landscaping / lawn / snow | Seasonal-recurring | High | **Wave 2** — strong but seasonal; late July is mid-season for lawn, pre-season for snow. |
| Moving | **One-off** (near-zero repeat) | Medium | **Skip for seeding.** No flywheel; high-stakes first booking. |
| Plumbing / Electrical | Low-medium, urgent | Medium | **Skip for seeding.** Regulated (see Decision 32), urgent jobs punish a thin/slow marketplace, and a bad match here is dangerous. |
| Painting / Carpentry | Low (project-based) | Medium | Wave 2+. |

**Day-one categories: Cleaning + Handyman only.** Two categories, one neighbourhood cluster,
enough providers that the third client to post a job still gets three quotes.

## Where these businesses actually are (Calgary-specific)

- **City of Calgary open licence dataset** (`data.calgary.ca`, dataset `vdjc-pybd`) — free,
  filterable, has trade name + address + status. This is a **ready-made recruiting list**:
  pull active `CONTRACTOR (NO PROVINCIAL LICENCE REQUIRED)` and personal-service records in the
  inner-city communities and you have names, categories and locations for free. (Same dataset
  Decision 32 uses for verification — one source, two jobs.)
- **Google Maps / Business Profiles** for cleaning + handyman in **Beltline, Mission,
  Kensington, Inglewood, Bridgeland, downtown core** — dense, walkable cluster, owner phone
  numbers usually listed.
- **Facebook groups**: "Calgary Buy Nothing / community" groups and trade groups where solo
  operators already advertise. Founder joins as a person, not a billboard.
- **Kijiji Calgary "Services"** — where solo cleaners and handymen already hustle for leads;
  they feel the pain SwingBy solves (chasing unqualified leads, no-show clients).

## The pitch (to a solo cleaner/handyman)

Lead with *their* pain, not your app. What they hate: paying for dead leads (HomeStars/Bark
charge $30–40/lead with no booking), chasing invoices, no-shows.

> "I'm Amr, I'm building SwingBy here in Calgary. It sends you local job requests where the
> client has already committed the payment on the platform — you quote, they accept, and you
> get paid on completion, no chasing. You'd be one of the first cleaners in Beltline on it.
> No monthly fee — I only take a cut when you actually get paid, and for the first 100
> businesses that's **5% instead of 10% for six months**. Fifteen minutes this week?"

Phone beats email 3:1 for this audience (the marketing doc's own benchmark) — solo operators
answer their phones because leads are their livelihood.

## The first-mover offer that costs SwingBy ~nothing

Everything here is a cut of money that doesn't exist yet, so the cash cost is zero:

- **5% instead of 10% for 6 months** (already built — `subscriptions.py` beta posture is
  track-only, and the web pricing page already advertises founder pricing). Costs nothing until
  they earn; halves a fee on money that wasn't flowing anyway.
- **Free "Calgary licensed" badge** (Decision 32) — the licence check is a free API call.
- **Founder concierge**: "text me directly if anything breaks." Costs the founder's time, which
  at 25 businesses is the cheapest and most retention-positive thing available.
- **Do NOT offer cash bounties or paid guarantees.** No revenue to fund them; violates the
  no-spend rule; attracts mercenary signups who never transact.

## Realistic week-by-week (one founder)

- **Week 1 — List + first contact.** Pull the Calgary licence dataset + Google Maps into a
  ~150-name list (cleaning + handyman, inner-city). Segment solo-first. Send 40 personalized
  emails + 20 calls. *Goal: 8–12 booked intro conversations.* (Expect ~10–15% reply, ~1/3 to a
  call — the doc's benchmark; do not expect better.)
- **Week 2 — Onboard the yes's + referral ask.** Walk each interested owner through signup
  personally (their signup drop-off is your biggest leak). At the end of every good call:
  "know another cleaner who'd want in?" Send 40 more cold + day-5 follow-ups to week 1.
  *Goal: 10–15 live business profiles.*
- **Week 3 — Density + first demand.** Keep recruiting to hit density in the *one* neighbourhood
  cluster. Now seed a little demand by hand: post 3–5 real jobs yourself / via friends so the
  first businesses get a real quote-and-book experience and don't churn from an empty feed.
  *Goal: 20–25 businesses, first real completed booking.*
- **Week 4 — Push to 25–40 + fix the leaks.** Final outreach wave + referrals. Watch which
  businesses actually respond to job posts; those are your real supply. *Goal: 25–40 signed up,
  10–15 actively quoting.*

## What will NOT work (be honest)

- **Paid ads for supply.** Zero density means paid demand churns; the marketing doc says hold
  business ads until month 3, and the no-spend rule says not at all yet. Correct on both counts.
- **Trade associations / BIAs as a *day-one* channel.** Real long-term unlock, but they move on
  their timeline (meetings, board approvals) — useless for getting 25 businesses this month.
  Plant them in parallel, don't depend on them.
- **Launching all 8 seeded categories.** Spreads the founder's outreach and kills quote-density
  in every category at once. Cut to two.
- **"Build it and they'll sign up."** A self-serve signup with no founder in the loop converts
  near zero for offline trades. The first 25 are hand-carried or they don't happen.
- **Recruiting demand before supply.** A client who posts a cleaning job and gets zero quotes
  never comes back. Supply first, seed a little demand by hand, then open the client side.

## One-line answer for the phone

Two categories only (cleaning + handyman), one inner-city cluster, founder-hand-recruited by
phone off the free City of Calgary licence list, pitched as "free committed-payment leads, no
monthly fee, 5% for 6 months" — 4 weeks of ~40 outreaches/week gets 25–40 signed and 10–15
actually active; skip ads, skip associations-as-day-one, skip the other six categories.
