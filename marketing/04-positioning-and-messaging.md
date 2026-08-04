# 04 — Positioning & Messaging

> What we say, how we say it, and how we beat the noise.

---

## One-liner

**SwingBy is the easiest way to find and book trusted local services in Calgary.**

Use this anywhere you have ~15 words. Headline, app store description first line, elevator pitch.

---

## Three sentence pitch

> SwingBy connects you with vetted, top-rated local service providers — from house cleaners to handymen to dog walkers — in your neighbourhood. Post a job and get bids in minutes, or browse businesses on a map. Payment runs through SwingBy — held in full from the moment you accept a quote, and released only when the job is done.

Use this on the homepage hero, app store description, and intro emails.

---

## Audience-specific messaging

### To clients

| Pain | Message |
|---|---|
| "I don't know who to trust" | Every business on SwingBy is reviewed by real customers and verified by us. |
| "I hate calling around for quotes" | Post once. Get bids from multiple businesses. Pick the one you like. |
| "What if they no-show?" | Only half the payment is released at booking, and the rest is held. If they don't show, report it and our team reviews the case and decides the refund. |
| "I want it now" | Use the map to see who's available near you, today. |

### To businesses

| Pain | Message |
|---|---|
| "I spend more time chasing leads than doing work" | SwingBy clients come to you. You pick the jobs you want. |
| "I get scammed by no-shows" | Half your money is released the moment the booking is confirmed — before you ever show up. |
| "I'm losing repeat clients because they forget my number" | Clients can favourite your business, and your booking chat thread stays open after the job — so they can reach you again without hunting for your number. |
| "I can't afford to advertise" | SwingBy is free to join. We only charge 10% when you get paid. |

---

## Voice & tone

| | Do | Don't |
|---|---|---|
| **Tone** | Direct, warm, confident | Salesy, hypey, urgent |
| **Vocabulary** | "service," "business," "client," "book," "post" | "vendor," "user," "buyer," "purchase," "transact" |
| **Sentences** | Short. Active. Plain. | Long, passive, jargon-heavy |
| **Punctuation** | Em-dashes for emphasis, sparingly | Exclamation marks |
| **Emoji** | Allowed in social posts. Never in transactional emails or in-app copy. | |

We sound like a competent neighbour, not a startup. We never say "revolutionary," "disrupt," "synergy," "unlock," "leverage," or "platform" (in user-facing copy — fine internally).

---

## Headline patterns that work

These are templates for blog posts, ads, social, app store screenshots:

- **"How to [outcome] in Calgary without [pain]"** — How to find a great house cleaner in Calgary without spending hours calling around
- **"[N] vetted [category] near you, ready today"** — 47 vetted cleaners near you, ready today
- **"Book a [service] in 60 seconds"** — Book a dog walker in 60 seconds
- **"From post to booked in [time]"** — From post to booked in under 5 minutes

---

## Competitor framing

We do not name competitors publicly. But we benchmark against them internally:

| Competitor | What they do | How we differ |
|---|---|---|
| Thumbtack | Lead-gen, businesses buy leads | We're booking-first, not lead-first; businesses get paid before they pay us |
| TaskRabbit | W2-style taskers, premium pricing | We're independent businesses, not Tasker-employed |
| HomeStars | Reviews + lead-gen for trades | We do bookings + escrow, not just reviews |
| Kijiji | Free classifieds | We're vetted, escrow-protected; safer |
| Facebook Marketplace / Groups | Free, ad-hoc | We're structured, with payment protection and reviews |
| Google Maps | Discovery + reviews | We close the loop with booking + payment |

**One-line framing:** "Like Thumbtack, but the client books directly and you get paid in escrow."

---

## SEO targets

These are the keyword themes the website (`web/pre-launch/src/pages/`) is structured around:

- `[service] near me` — house cleaner near me, handyman near me, etc.
- `best [service] in [neighbourhood] Calgary` — best dog walker in Mission Calgary
- `book a [service] online Calgary` — book a cleaner online Calgary
- `find a [service] Calgary` — find a handyman Calgary
- `[service] cost Calgary` — house cleaning cost Calgary (informational, blog)

Build 50 location-category pages (5 categories × 10 neighbourhoods) before paid ads start. Templates exist: `CategoryPage.jsx`, `CalgaryPage.jsx`.

---

## App Store / Play Store copy

> **Rewritten 2026-07-31 to match the build.** The previous version described a
> payment model this app has never had. It claimed "pay in stages" and "half
> releases at booking"; the code has one charge, at the moment you accept a
> quote — `charge_at_accept_enabled()` returns True by default and
> `charge_at_post_enabled()` returns False, and `partial_released` is marked in
> `escrow.py` as a legacy state kept only for back-compat. There is no staged
> release to describe.
>
> This matters beyond honesty: **App Store Guideline 2.3.1 is "no misleading
> metadata"**, and a payments claim a reviewer can disprove in two taps is the
> easiest kind to catch. "No monthly fees" was false for the same reason —
> business subscriptions exist (D2.4). "Vetted" was overstated:
> `license_status` is a manual flag that most businesses have never had set.
>
> If the payment model changes, this block changes with it. Anything here that
> describes money should be checkable against
> `backend/app/services/payment_triggers.py` and `escrow.py`.

### Title (30 chars)
**SwingBy: Book Local Services**

### Subtitle (30 chars)
**Cleaners, handymen, & more**

### Short description (80 chars)
**Find local services in Calgary. Post a job, compare quotes, pay when you book.**

### Long description (full)

```
Find and book local services in your neighbourhood — without the hassle.

SwingBy connects you with house cleaners, handymen, dog walkers, personal trainers, lawn care, and more — all in one app. Post a job and get quotes from local businesses in minutes, or browse providers on a map.

WHY SWINGBY

✓ Real reviews — from people who actually booked and paid through the app
✓ Your money is held, not handed over — SwingBy holds it until the job is done
✓ Local first — see businesses near you, today
✓ No phone tag — post once, get quotes back, pick the one you like
✓ Both sides review each other

HOW IT WORKS

1. Post what you need, or browse the map
2. Local businesses send you quotes
3. Pick the one you trust — you pay securely when you accept it
4. SwingBy holds the payment and releases it to the pro once the work is done
5. Leave a review

FOR BUSINESSES

Join SwingBy free and keep 90% of every job — we take 10% when a job completes, and we never sell you leads. Set your radius, list your services, and start getting bookings. Optional paid plans add extras like auto-quoting.

NOW LIVE IN CALGARY
```

---

## Tagline candidates

- **The trust layer for local services** (B2B-leaning)
- **Local services, finally simple** (consumer-leaning) ← recommended
- **Book local. Pay safely. Done.** (transactional)

**Recommended:** "Local services, finally simple."

---

## Cross-links

- [09-brand-guidelines.md](09-brand-guidelines.md) — visual identity
- [07-content-calendar.md](07-content-calendar.md) — where to use this messaging
