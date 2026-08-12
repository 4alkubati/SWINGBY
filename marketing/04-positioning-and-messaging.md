# 04 — Positioning & Messaging

> What we say, how we say it, and how we beat the noise.

> ### ⚠️ Reconciled against [FACTS.md](FACTS.md) on 2026-08-12
>
> A sweep found the **50/50 staged-release claim still alive in this file, twice**
> — in the client table (*"Only half the payment is released at booking"*) and the
> business table (*"Half your money is released the moment the booking is
> confirmed"*). Both are FACTS §2 banned claims, verbatim. They survived the
> 2026-07-31 rewrite below because that pass only touched the App Store block.
>
> Also removed: *"verified by us"* and *"vetted"* (§4 — no verification flow
> exists), *"top-rated"* and *"reviewed by real customers"* (§4 — we have no
> reviews), *"[N] vetted [category] near you"* (§4 — the same invented-count
> pattern as the *"18 verified pros"* line flagged in §9), and *"free to join, we
> only charge 10% when you get paid"* (§2.2 — a business subscription exists).
>
> **This file is the messaging authority the rest of the folder derives from.**
> That is why it drifting is expensive, and why it now cites a FACTS section for
> every money and trust claim.

---

## One-liner

**Swingbyy is the easiest way to find and book local services in Calgary.**

Use this anywhere you have ~15 words. Headline, app store description first line, elevator pitch.

> Not *"trusted"*, *"vetted"*, or *"top-rated"* — all three imply a verification
> or reputation layer we do not have (§4). The honest edge is the payment
> mechanic, not a quality claim.

---

## Three sentence pitch

> Swingbyy connects you with local service businesses — from house cleaners to handymen to dog walkers — in your neighbourhood. Post a job and get quotes in minutes, or browse businesses on a map. Payment runs through Swingbyy — the full amount is held from the moment you accept a quote, and released when you approve the finished work.

Use this on the homepage hero, app store description, and intro emails.

> The release trigger is **the client approving**, not the work being done.
> *"Released when the work is done"* is banned by name in §2 — it re-describes the
> exact M1 defect PR #81 fixed, where a business-only "Complete" endpoint moved
> the money with the client nowhere in the path.

---

## Audience-specific messaging

### To clients

| Pain | Message | Authority |
|---|---|---|
| "I don't know who to trust" | Your payment is held until you approve the work. You see before and after photos on the job before anything is released. | §2, §3 proof of work |
| "I hate calling around for quotes" | Post once. Get quotes from multiple businesses. Pick the one you like. | §1 |
| "What if they no-show?" | Nothing is released until you approve. If something goes wrong, report it and our team reviews the case and decides the refund. | §2 |
| "I don't want strangers knowing my business" | They see the work, your photos and the area — not your name, your address, or your budget, until you accept one. | §3.2 |
| "I want it now" | Use the map to see businesses near you. | §3 |

> The no-show row used to read *"Only half the payment is released at booking,
> and the rest is held."* That is the §2 banned claim. **Nothing is released
> before approval** — the full amount sits in escrow the whole time.
>
> The "I want it now" row previously promised *"who's available near you,
> today."* There is no availability signal in the product; the map shows
> businesses, not live availability.

### To businesses

| Pain | Message | Authority |
|---|---|---|
| "I spend more time chasing leads than doing work" | Swingbyy clients come to you. You pick the jobs you want. | §1 |
| "I can't price a job I can't see" | You get the work, the client's photos and the area — enough to quote the actual job. | §3.2 |
| "I get undercut before I even quote" | You never see the client's budget. You quote your own number instead of racing to theirs. | §3.2 |
| "I'm losing repeat clients because they forget my number" | Clients can favourite your business, and your booking chat thread stays open after the job — so they can reach you again without hunting for your number. | §3 |
| "I don't want to pay for leads that go nowhere" | Swingbyy takes 10% of an on-platform booking, at release. Quoting costs nothing. | §2.2 |

> The no-show row used to read *"Half your money is released the moment the
> booking is confirmed — before you ever show up."* Banned (§2), and it was the
> single most misleading line in the folder: it promised businesses money that
> does not move until the client approves.
>
> The last row used to read *"free to join. We only charge 10% when you get
> paid."* §2.2 bans *"we only make money when you do"* and *"free for
> businesses"* — `businesses.subscription_status` is a real column with a real
> Stripe checkout leg, and it gates auto-bidding. **Say nothing about monthly
> cost at all** — neither a number nor a denial — until §8's open `NEEDS-FACT` on
> the subscription price is answered.

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

- **"How to [outcome] in Calgary without [pain]"** — How to find a house cleaner in Calgary without spending hours calling around
- **"Post a [service] job in [time]"** — Post a dog walking job in 60 seconds
- **"You set a budget. Nobody bidding sees it."** — the §3.2 privacy angle, and the strongest unused fact we have
- **"Nothing moves until you approve."** — the §2 escrow mechanic in five words

> 🚫 **"[N] vetted [category] near you, ready today"** — deleted. It has three
> banned things in one line: an invented supply count, *"vetted"*, and an
> availability promise (§4). This is the same pattern as the *"18 verified pros,
> already near you"* line that FACTS §9 flags in `social-assets/render.js`, and
> as the `18 pros near you` element the video pipeline crops out of every frame.
> A headline template is how that claim keeps regenerating — it was sitting here
> as an approved pattern.
>
> 🚫 **"From post to booked in [time]"** — we have no data for any such number,
> and inventing one is §4.

---

## Competitor framing

We do not name competitors publicly. But we benchmark against them internally:

| Competitor | What they do | How we differ |
|---|---|---|
| Thumbtack | Lead-gen, businesses buy leads | We're booking-first, not lead-first; businesses get paid before they pay us |
| TaskRabbit | W2-style taskers, premium pricing | We're independent businesses, not Tasker-employed |
| HomeStars | Reviews + lead-gen for trades | We do bookings + escrow, not just reviews |
| Kijiji | Free classifieds | We hold the payment until the client approves; a classified hands a stranger cash |
| Facebook Marketplace / Groups | Free, ad-hoc | We're structured, with the payment held until approval |
| Google Maps | Discovery + reviews | We close the loop with booking + payment |

**One-line framing:** "Like Thumbtack, but the client books directly and the payment is held until they approve the work."

> *"We're vetted"* and *"with reviews"* were removed — §4. Note that the
> Thumbtack row's *"businesses get paid before they pay us"* is true (the 10%
> comes out at release, not at capture — §2, changed 08-08) and is worth keeping.
>
> **This table is internal.** The rule at the top of the section — *we do not name
> competitors publicly* — still stands.

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

> **Rewritten 2026-07-31, corrected again 2026-08-12.** The 07-31 pass fixed the
> payment model — the code has one charge, at the moment you accept a quote
> (`charge_at_accept_enabled()` True, `charge_at_post_enabled()` False, and
> `partial_released` marked in `escrow.py` as a legacy state kept for
> back-compat). **That part held.** But the block below it still shipped five
> claims that the 08-08 and 08-11 rulings killed, because the 07-31 header was
> written before those rulings existed and nobody re-read what sat under it:
>
> | Was | Why it's gone |
> |---|---|
> | *"Real reviews — from people who actually booked and paid"* | §4 — we have **no reviews**. The demo seed's 22 are seeded figures for `nadia-whitfield@demo` and may never be quoted |
> | *"Both sides review each other"* | Same — describes a populated system that is empty |
> | *"Optional paid plans add extras like **auto-quoting**"* | §4 — Kira's 08-08 ruling: do not advertise auto-bidding **at all** until there is a client base. Explicitly not a phrasing problem |
> | *"Join SwingBy free… we never sell you leads"* | §2.2 — a business subscription exists |
> | *"**NOW LIVE IN CALGARY**"* | §5 — **not launched.** Listing is Oct 1–10, 2026 |
> | *"releases it to the pro once the work is done"* | §2 banned by name — **approval** releases it, not completion |
> | Title *"SwingBy: Book Local Services"* | §5 marks this line stale by name; the listing is simply **Swingbyy**, and the rename is what removed the collision with five other apps |
>
> **App Store Guideline 2.3.1 is "no misleading metadata."** A payments or
> social-proof claim a reviewer can disprove in two taps is the easiest kind to
> catch, and the listing goes live in seven weeks. Anything here that describes
> money is checkable against `backend/app/services/payment_triggers.py` and
> `escrow.py`; anything describing reviews or verification is checkable by
> logging in.

### Title (30 chars)
**Swingbyy**

### Subtitle (30 chars)
**Book local services in Calgary**

### Short description (80 chars)
**Post a job in Calgary. Local businesses quote. Your payment is held till you approve.**

### Long description (full)

```
Find and book local services in your neighbourhood — without the hassle.

Swingbyy connects you with house cleaners, handymen, dog walkers, personal trainers, lawn care, and more — all in one app. Post a job and get quotes from local businesses, or browse them on a map.

WHY SWINGBYY

✓ Your money is held, not handed over — the full amount stays in escrow until you approve the finished work
✓ You see the work before you release it — businesses upload before and after photos on the job
✓ Your budget stays yours — businesses see the work, your photos and the area, but never your name, your address, or your budget
✓ No phone tag — post once, get quotes back, pick the one you like
✓ Follow the job — confirmed, on the way, in progress, done

HOW IT WORKS

1. Post what you need, or browse the map
2. Local businesses send you their price
3. Pick one — you pay securely when you accept
4. Swingbyy holds the full amount while the work happens
5. They upload before and after photos; you approve, and the payment is released

FOR BUSINESSES

Set your radius, list your services, and quote on jobs in your area. You see the work, the photos and the area — enough to price it properly — but never the client's budget, so you quote your own number. Swingbyy takes 10% of an on-platform booking, taken when the payment is released to you.

CALGARY
```

> **Two blanks left deliberately.** The long description says nothing about
> monthly cost — §2.2's `NEEDS-FACT` on the subscription price is open, and the
> rule is *neither a number nor a denial*. And it ends on `CALGARY`, not a launch
> claim, until the listing is actually live.

---

## Tagline candidates

- **The trust layer for local services** (B2B-leaning)
- **Local services, finally simple** (consumer-leaning) ← recommended
- **Book local. Pay safely. Done.** (transactional)

**Recommended:** "Local services, finally simple."

---

## Cross-links

- **[FACTS.md](FACTS.md) — the claim boundary. It outranks this file.**
- [09-brand-guidelines.md](09-brand-guidelines.md) — visual identity
- [07-content-calendar.md](07-content-calendar.md) — where to use this messaging
