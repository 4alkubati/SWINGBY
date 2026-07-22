---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy — Press Kit

For journalists, podcasters, and creators. Updated 2026-05-28.

---

## One-line

**SwingBy is the Calgary-built marketplace where you post a job and local pros quote it within minutes.**

## One-paragraph

SwingBy is a service marketplace for everyday work — cleaning, plumbing, lawn, painting, electrical, moving, carpentry. Clients post a job with their schedule and budget. Local businesses send quotes (price only, no essays). The client picks one, the worker shows up, uploads photo proof of work, and escrow releases payment automatically. Reviews are on the individual worker — not just the company — so the person who actually did the job earns their reputation. Built in Calgary by Swingbyy Inc., launching summer 2026.

## Three-paragraph

SwingBy fixes the awkward dance of hiring local services. Instead of three quotes by text, then a no-show, then an "is e-transfer okay?" conversation, SwingBy lets you post a job in 30 seconds and lock in a vetted pro within the hour. The client sets the date and time when posting — businesses know the schedule before they quote, so no one accepts a job they can't deliver. Photos of the space go to every quoting business, so the worker isn't surprised on the day.

The model is built around three commitments. **Workers earn reputation as individuals**: Khalid earns his own star rating under his company's roof, so good cleaners get paid more even when they work for a 20-person operation. **Money is released in two stages**: half releases when the booking is confirmed, the other half (minus a 10% platform fee) when the job is marked complete. **The chat opens on the quote, not before it**: a business can only reach a client on a job it has actually quoted on, so there is no cold contact and no off-thread pressure. The cancellation policy is symmetric — clients pay 25-50% if they bail late, businesses lose the booking if they bail late.

Swingbyy Inc. is a Calgary company. The technical stack is Supabase (Postgres + auth in ca-central-1), FastAPI on Render, React Native on Expo, and Cloudflare for waitlist + pre-launch. The team has spent more time on the cancellation flow and dispute mechanism than on the marketplace UI — because in a service marketplace the edges of the experience are where trust either compounds or evaporates. SwingBy launches publicly in Calgary in summer 2026 with expansion to Edmonton + Vancouver tracked for 2027.

---

## Quick facts

| Detail | Value |
|---|---|
| Founded | 2026 |
| Headquarters | Calgary, AB, Canada |
| Founder | (to be added) |
| Employees | (to be added) |
| Funding | (to be added) |
| Categories supported at launch | Cleaning, Plumbing, Lawn, Electrical, Moving, Painting, Carpentry |
| Cities at launch | Calgary |
| Platform fee | 10% from the business (client pays the quoted price, period) |
| Payment model | Escrow — 50% on confirmation, 50% minus fee on completion |
| App availability | iOS + Android via Expo / EAS |
| Backend | FastAPI + Supabase (ca-central-1) |
| Privacy compliance | PIPEDA + Alberta PIPA |

---

## Why now

Three structural shifts collide:

1. **Skilled-trade labour shortage in Western Canada.** Demand for cleaning, electrical, and lawn work is outpacing supply. Workers who can self-promote earn 30-50% more.
2. **Erosion of trust in classifieds.** Kijiji + Facebook Marketplace listings for services are flooded with no-shows and lowballers. Both sides want better filtering.
3. **Mobile-native expectation.** Clients under 40 expect Uber-grade UX for booking anything. The incumbents (Thumbtack, HomeStars) feel ten years old.

SwingBy is the first marketplace built mobile-first for Canadian skilled trades with worker-level reviews and symmetric cancellation rules.

---

## Quotable lines

- *"We built the cancellation policy first. If you can't get cancellations right, the rest of the marketplace breaks."*
- *"Khalid the cleaner shouldn't have to start over every time he changes companies. His rating follows him."*
- *"Chat opens on the quote, never before it. If you want to talk to a client, quote their job — that's the door."*
- *"We charge 10% from the business, not the client. The quoted price is the quoted price."*

---

## Brand

| Asset | Where |
|---|---|
| Logo (PNG, dark + light) | `mobile/assets/icon.png` and `adaptive-icon.png` |
| Splash screen | `mobile/assets/splash.png` |
| Brand colours | Primary orange `#FF5C00` on near-black `#07080a`. Body white `#ffffff` |
| Typography | Headings: Space Grotesk Bold; Body: Inter |
| Tone | Direct, confident, zero fluff. Never cute. Never corporate. |

---

## Contact

**Press inquiries:** 4alkubati@gmail.com (subject: "Press — your publication name")
**General:** 4alkubati@gmail.com

We respond within one business day. We don't do paid placement.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
