# SwingBy — Launch Email Sequence (3 emails)

Subjects + bodies for the launch sequence. Send via your transactional provider (Resend, SendGrid, etc.) or as a Notion-triggered mailer.

---

## Email 1 — Waitlist confirmation (sends immediately on signup)

**Subject:** You're on the SwingBy list 🟠

**Preheader:** We'll text you the moment your city goes live.

```
Hey {{first_name}},

You're in. We'll text you the moment SwingBy launches in {{city}}.

While you wait — three things you can do right now:

1. Tell us what you'd use SwingBy for first.
   Just reply to this email. We read every one.

2. Share the link with one friend.
   {{referral_link}}
   Both of you get $10 off your first booking when we launch.

3. Follow us for early-access news.
   We'll post invites to closed beta there first.
   (links to socials when they exist)

Thanks for being on board.
— The SwingBy team
Calgary, AB

P.S. If you're a contractor or service business and want to be one of the first 50 listed at launch, hit reply with "I'm a business" and we'll get you in.
```

---

## Email 2 — Beta invite (sends T-7 days before launch to top 100 signups)

**Subject:** Early access starts now — your SwingBy invite

**Preheader:** You're in the first 100. Here's your code.

```
Hey {{first_name}},

We're opening SwingBy to the first 100 waitlist members today — one week before public launch. You're one of them.

Your invite code: {{invite_code}}

Open the app and tap "I have an invite" on the welcome screen, paste the code, and you're in.

What works on day one:
  ✓ Post a job, get quotes within minutes
  ✓ Browse 30+ verified Calgary businesses
  ✓ In-app messaging once you confirm a quote
  ✓ Photo proof of work + escrow payment
  ✓ Reviews on individual workers, not just companies

What's still cooking:
  – Stripe payment integration (paying outside the app for now)
  – Detailed analytics for business owners
  – More cities

If you hit a bug, tap Settings → Help & FAQ → Report a bug. We're a small team and we ship fixes in days, not weeks.

Welcome to the loop.
— The SwingBy team
```

---

## Email 3 — Public launch (sends to entire waitlist on launch day)

**Subject:** SwingBy is live in Calgary 🟠 — your link inside

**Preheader:** Post a job in 30 seconds. Quotes within minutes. Booked the same day.

```
Hey {{first_name}},

We're live.

Get the app:
  iOS:     {{ios_app_link}}
  Android: {{android_app_link}}

What SwingBy does:

  → You post what you need (cleaning, plumbing, lawn, painting, more)
  → Local businesses send quotes — price only, no essays
  → You pick the best one
  → Worker shows up, does the job, uploads proof
  → Payment releases automatically — no chasing, no awkward etransfers

Three reasons it's different:

  • You set the date and time. Businesses quote knowing the schedule.
  • Reviews are on the actual worker, not just the company. Khalid earns his own rating.
  • Escrow protects both sides. Worker gets paid on completion. You're covered if work isn't done.

First-booking credit: {{credit_amount}} off — applies automatically the first time you book.

Welcome to a better way to hire local.
— The SwingBy team
Calgary, AB

P.S. We're hiring. If you know a Calgary engineer or designer who'd love to work on this, send them our way: 4alkubati@gmail.com
```

---

## Operational notes

- Send from a verified domain (e.g. hi@swingbyy.com) — SPF + DKIM + DMARC set up
- Plain-text fallback for every email (most providers auto-generate)
- All links use UTM params: `?utm_source=email&utm_medium=lifecycle&utm_campaign=launch_<n>`
- Track opens + clicks (Plausible-compatible — no third-party pixel needed if your provider supports it)
- A/B test subject lines on the public launch email — the first 200 recipients get variant A, next 200 get variant B, then winner sends to the rest
- Suppress unsubscribed addresses — never email after a one-click unsubscribe per CASL
- Footer on every email: physical mailing address + unsubscribe link (CASL requirement in Canada)
