---
group: plan
project: swingby
hub: "[[MOC-Plan]]"
tags: [plan]
---
# Costs, Credentials & APIs — everything SwingBy needs

> What it costs, what to sign up for, what data/keys each piece needs. Keep all keys in a password manager — never in chat or a committed file.

## 💸 Costs (what you'll actually pay)

| Item | Cost | When you need it | Notes |
|---|---|---|---|
| **Apple Developer Program** | **$99 / year** | Phase 2–3 (iOS store/TestFlight) | Required for any iOS distribution, even TestFlight beta |
| **Google Play Console** | **$25 one-time** | Phase 2–3 (Android) | One payment, ever; note Google's 12-tester rule for new accounts |
| **Supabase** | **Free** now → **$25/mo Pro** later | Pro only when you need backups/scale | Free tier fine through beta |
| **Resend (email)** | **Free** (3,000/mo, 100/day) → **$20/mo** (50k) | Domino 1, now | Free tier covers beta easily |
| **Expo EAS (builds)** | **Free** (15 iOS + 15 Android builds/mo) | Domino 3 | Free tier covers beta; paid only at heavy build volume |
| **Stripe** | **No monthly** — 2.9% + $0.30 per transaction | Phase 2 (live payments) | Beta runs sandbox = $0 |
| **Render (backend host)** | **Free** (spins down) → ~**$7/mo** always-on | Now / before launch | Free works for beta; paid before public so it doesn't sleep — verify current price at signup |
| **n8n (automations)** | **Free** (self-host Docker) | Now | Running locally already |
| **Analytics** | **Free** (self-host Umami) or ~$9/mo Plausible | Parked | Deferred until driving traffic |
| **Google Maps API** | Pay-as-you-go (free monthly credit) | Domino 2–3 (map screens) | Restrict the key to your app |
| **Domain swingbyy.com** | Already owned | — | — |
| **Sentry / hCaptcha** | Free tiers | Now | Error tracking + bot protection |

**Bottom line for the beta:** ~$0. Real money starts in Phase 2: **$99 (Apple) + $25 (Google) + ~$7/mo (Render)** ≈ **$124 to get to stores**, plus Stripe % once you take live payments.

## 🔑 Credentials checklist (store in password manager)

| Credential | For | Status |
|---|---|---|
| Telegram bot token + chat ID | Morning brief delivery | ✅ done (rotate the leaked one) |
| Notion integration token | Waitlist count | ✅ done |
| Resend API key + DNS access | Domino 1 email | 🔄 started (DNS verifying) |
| Supabase service key | Backend (already set) | ✅ |
| Google Maps API key | Map screens | ⬜ replace placeholder before build |
| Apple Developer account | iOS builds | ⬜ Phase 2 |
| Google Play account | Android builds | ⬜ Phase 2 |
| Stripe keys (test → live) | Payments | ⬜ test now, live Phase 2 |
| Gmail OAuth (Google Cloud project) | Inbox in brief | ⬜ deferred |
| Meta Graph token | IG/FB analytics | ⬜ deferred |

## 🔌 API endpoints in play

| Service | Endpoint / method | Used for |
|---|---|---|
| SwingBy backend | `https://swingbyy-api.onrender.com` | The app's API (35 routes) |
| Resend | `https://api.resend.com/emails` (POST) | Send signup/notification emails |
| Plausible (if used) | `https://plausible.io/api/v2/query` (POST) | Site visitors |
| Notion | n8n Notion node → SwingBy Waitlist DB | Waitlist count |
| Telegram | n8n Telegram node | Brief delivery |
| Google Maps | Maps SDK (mobile) | Geo-browse screens |

## 📧 Gmail activation (when you do Step 10, deferred)
1. Google Cloud Console → new project → enable **Gmail API**.
2. OAuth consent screen (External, your email as test user).
3. Create OAuth client → use it in n8n's Gmail credential.
This is the rabbit hole — only do it once the beta is moving.

## 📊 Data you need to collect (for launch decisions)
- Waitlist signups (Notion) — top of funnel.
- Beta testers recruited + active.
- First end-to-end bookings completed.
- Bugs found per tester session.
- (Later) site visitors → signup conversion %.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Plan]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
