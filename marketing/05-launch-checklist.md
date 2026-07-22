---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# 05 — Launch Checklist

> Day-by-day checklist from T-14 (two weeks before launch) through T+30. Check each box before moving on.

---

## T-14 — Two weeks before launch

### Product (mobile + web)
- [ ] Mobile app builds successfully on iOS (TestFlight) and Android (internal track)
- [ ] Web app deployed to production domain (swingbyy.com or chosen domain)
- [ ] End-to-end test: signup → post job → business expresses interest → accept → message → complete → review (on real device, not simulator)
- [ ] Backend deployed to Render/Fly.io with health check green
- [ ] Supabase production project has RLS verified — RLS itself is on for all tables, but 0 advisor warnings is NOT true as of 2026-07-19: 1 open security advisor remains (HIBP leaked-password protection, dashboard-only toggle — see `docs/SECURITY.md`). Re-run `mcp__claude_ai_Supabase__get_advisors` before checking this box.
- [ ] Stripe (or chosen processor) account approved and webhook tested
- [ ] Error monitoring (Sentry) reporting events from mobile + web + backend
- [ ] Analytics (PostHog / Plausible) firing key events: signup, post, interest, booking, completion

### Legal
- [ ] Privacy policy live at `/privacy` — see `privacy-and-security/privacy-policy.md`
- [ ] Terms of service live at `/terms`
- [ ] Cookie policy live at `/cookies`
- [ ] Business registration confirmed (Alberta — registered as a corporation or sole proprietor)
- [ ] GST/HST registration if revenue >$30k/year expected
- [ ] CASL (Canadian Anti-Spam Law) consent flow on email signups — opt-in checkbox, double opt-in for marketing

### Marketing assets
- [ ] Logo finalized in SVG + PNG (light + dark variants)
- [ ] App icon (1024×1024) approved
- [ ] App store screenshots (5 per platform, all device sizes)
- [ ] Landing page hero video or animated demo (30s loop)
- [ ] Press kit folder ready (logo, screenshots, founder bio, one-pager)
- [ ] Social handles claimed: @swingbyca on Instagram, TikTok, Twitter/X, LinkedIn, Facebook
- [ ] Domain `swingbyy.com` (and `.app` if available) registered

### Outreach
- [ ] Spreadsheet of 50 target businesses (name, category, neighbourhood, contact) ready
- [ ] First 20 cold emails sent
- [ ] Waitlist live with email capture working (Formspree, Resend, or Supabase)
- [ ] 200 waitlist signups (target — push social if behind)

---

## T-7 — One week before launch

### Product
- [ ] All P0 bugs from end-to-end test closed
- [ ] Push notifications tested on real devices (booking confirmation, message, etc.)
- [ ] Payment escrow flow tested with real (or Stripe test mode) cards
- [ ] Cancellation + dispute flow tested
- [ ] Maps load correctly with real Google Maps key (not placeholder)
- [ ] Empty states designed and tested (no businesses in area, no posts yet, etc.)

### Onboarding
- [ ] 10 pre-committed businesses onboarded personally (founder walks each through)
- [ ] Each onboarded business has at least one service listed with price + photo
- [ ] Each has uploaded at least one before/after or work photo
- [ ] Welcome email automation tested (Resend / Postmark / SES)

### Launch content
- [ ] Day-1 blog post drafted: "We're live. Here's why we built SwingBy."
- [ ] Day-1 Instagram + LinkedIn posts queued
- [ ] Day-1 press release drafted (see `marketing/press/launch-press-release.md` — TODO)
- [ ] Subject lines + body for "We're live" email to waitlist drafted

---

## T-0 — Launch day

### Morning (8am MT)
- [ ] Final smoke test: signup, post, book, complete on prod
- [ ] Confirm backend deploy, Stripe webhook, email sending all green
- [ ] App stores show "available" status
- [ ] Web `/status` page live and shows "All systems operational"

### Mid-morning (10am MT)
- [ ] Send "We're live" email to entire waitlist
- [ ] Publish day-1 blog post
- [ ] Post on Instagram, LinkedIn, TikTok, Twitter/X
- [ ] DM all 10 onboarded businesses: "We're live — go post your first listing"
- [ ] Personally text 20 friends asking them to sign up and post a real job

### Afternoon (1pm MT)
- [ ] Email press release to Calgary Herald, BetaKit, MobileSyrup, CTV Calgary
- [ ] Post in r/Calgary, r/CalgaryBusiness, r/Entrepreneur — humble launch post
- [ ] Reply to every comment / DM / email within 1 hour
- [ ] Check analytics dashboard hourly

### Evening (5pm MT)
- [ ] Review the day: signups, posts, bookings, errors
- [ ] Fix any P0 bugs that surfaced (don't sleep on these)
- [ ] Founder posts a personal note on LinkedIn: what shipped, what's next

---

## T+1 → T+7

- [ ] Daily: morning standup with yourself — 3 things to focus on today
- [ ] Daily: scan Sentry for errors. Fix or triage.
- [ ] Daily: reply to every user message within 2 hours
- [ ] Daily: post on at least one social channel (variety: behind-the-scenes, customer stories, tips)
- [ ] Day 3: send second email to waitlist — "100 users in 72 hours" (or whatever real number)
- [ ] Day 5: 30-min interview with first 5 active businesses. What's working? What sucks?
- [ ] Day 7: weekly recap blog post — be specific with numbers

---

## T+14

- [ ] User interviews: 5 businesses + 5 clients
- [ ] First retention check: of day-1 signups, how many returned by day 14? (Target: 25%+)
- [ ] Decide on first ad spend: $200-500 in week 3 Google Ads, branded only at first
- [ ] If MRR > $500, ship the Featured Listing paid feature
- [ ] Audit `marketing/08-kpis-and-metrics.md` — are we on track?

---

## T+30

- [ ] Public 30-day recap: blog post + LinkedIn long-form + Instagram carousel
- [ ] Email all churned users with a "what would have made you stay?" survey
- [ ] Reach out to 3 podcasts or local media for interview
- [ ] Decide: stay focused on Calgary, or open a second neighbourhood?
- [ ] Hire/contract decision: do we need help (designer? marketer?) — only if MRR > $5k

---

## Anti-checklist (do NOT do these)

- ❌ Don't launch on a Friday (no one's around to fix bugs)
- ❌ Don't launch with bugs you "think are fine"
- ❌ Don't pay for ads in week 1 (you have no signal on what converts)
- ❌ Don't add a new feature before you have 100 active users
- ❌ Don't expand to another city before 250+ active businesses in Calgary
- ❌ Don't hire before MRR $5k
- ❌ Don't raise money before MRR $5k (you'd be raising on hope, not data)

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]

**Related:** [[2026-07-19]]
<!-- graph-wire:end -->
