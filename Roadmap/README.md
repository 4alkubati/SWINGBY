---
type: index
status: active
tags: [roadmap, dominoes, index]
---

# 🁢 Roadmap — start here

One ID scheme: **dominoes**. Knock one and the next falls.

* **`D<n>`** — a thing to *do*. Work. Every task in this repo is one of these.
* **`DEC-<n>`** — a thing to *decide*. Not a domino: nothing falls until a human
  answers it, and no amount of engineering knocks it over.

Renamed 2026-08-13. `H`, and the ad-hoc `F`/`B`/`W` prefixes, are gone —
crosswalk at the bottom so old references still resolve.

## Which file answers which question

| Question | File |
|---|---|
| What is the ordered plan to beta? | **`DOMINOES.md`** + `dominoes/D2.0–D8` |
| What is actually live right now? | **`STATUS.md`** |
| What blocks launch? | **`LAUNCH-BLOCKERS.md`** |
| What can only Kira do? | **`HUMAN-TODO.md`** (D10–D39, DEC-1–DEC-12) |
| What did the last audit find? | **`OPEN-2026-08-12.md`** |
| What did the walkthrough find? | **`WALKTHROUGH-2026-08-06.md`** |
| What does it cost / which keys? | **`COSTS-CREDENTIALS-APIS.md`** |

Anything under `archive/` is history. It is not planning input.

## The two ID spaces, and why they collided

`dominoes/` numbered work `D2.0…D8`. `HUMAN-TODO.md` separately numbered
*decisions* `D1…D7`. Two different `D5`s existed at once — one meant "hire paid
testers", the other meant "instant payouts". Decisions moved to `DEC-` because a
domino is something you knock over, and a decision is not.

## Live chain — what unblocks what

```
D10 eas login
 ├─ D11 EXPO_PUBLIC_API_URL      (build FAILS without it)
 ├─ D12 GOOGLE_MAPS_API_KEY      (silent blank maps)
 └─ DEC-8 Android or iOS         → preview build

D14 Team ZTYJ33HPDX: Individual or Org?   ← nobody recorded this
 └─ D15 App Store record → D16 ascAppId → D17 .p8 key → D18 agreements
      ↑ also gated by DEC-2 (incorporation)

DEC-7 subscriptions on/off
 └─ D13 STRIPE_PRICE_TEAM        ← every business 500s on subscribe today

D25 create + verify a Google Business Profile
 └─ D26 Business Profile API access        ~11-14 weeks

D21 Instagram → Business account
 └─ D22 social tokens → D20 display names → DEC-10 link in bio
```

## Crosswalk — old id → new id

| Was | Now | What |
|---|---|---|
| `D1` | `DEC-1` | Client goes quiet after work is done -> auto-release 24h |
| `D2` | `DEC-2` | Incorporation / holding company, privacy-policy entity |
| `D3` | `DEC-3` | Apple Pay merchant id |
| `D4` | `DEC-4` | Card on file |
| `D5` | `DEC-5` | Instant payouts (Stripe Connect Express) |
| `D6` | `DEC-6` | Credit redemption at checkout |
| `H26` | `DEC-7` | Subscriptions: billing on, or back to track-only |
| `H30` | `DEC-8` | Preview build platform: Android or iOS |
| `H13` | `DEC-9` | Does swingbyy.com serve web/launch/ instead of pre-launch |
| `H17` | `DEC-10` | Link in bio: waitlist or App Store |
| `H16` | `DEC-11` | Social publisher: plain script, not n8n |
| `H14` | `DEC-12` | Handle to claim: swingbyy (TikTok swingbyyy) |
| `H27` | `D10` | eas login — blocks every EAS command |
| `H28` | `D11` | EXPO_PUBLIC_API_URL in EAS preview — build FAILS without it |
| `H29` | `D12` | GOOGLE_MAPS_API_KEY in EAS preview — silent blank maps |
| `H25` | `D13` | Render STRIPE_PRICE_TEAM — every business 500s on subscribe |
| `H7` | `D15` | App Store Connect app record |
| `H8` | `D16` | ascAppId + Apple ID email into eas.json |
| `H9` | `D17` | App Store Connect API key (.p8) |
| `H10` | `D18` | Paid Apps / Free agreement |
| `H24` | `D19` | Cloudflare CNAME www -> swingbyy.com |
| `H22` | `D20` | Display names on the live social accounts |
| `H23` | `D21` | Instagram -> Business account (unblocks Graph API) |
| `H15` | `D22` | Social tokens in .env.social |
| `H20` | `D23` | YouTube handle — last one unclaimed |
| `H12` | `D24` | Keep-warm cron for Render |
| `H31` | `D26` | Google Business Profile API access |
| `H1` | `D30` | Two migrations applied |
| `H2` | `D31` | PR #81 merged |
| `H3` | `D32` | STRIPE_SECRET_KEY confirmed test key |
| `H4` | `D33` | Apple Developer account active |
| `H5` | `D34` | Sign In with Apple capability |
| `H6` | `D35` | Supabase Auth -> Apple |
| `H11` | `D36` | ENV=production in Render |
| `H18` | `D37` | Stripe Connect enabled |
| `H19` | `D38` | Cloudflare email routing for amr@ |
| `H21` | `D39` | D5 payouts migrations applied |
| — | `D14` | Confirm Apple Team enrolment type (new) |
| — | `D25` | Create + verify a Google Business Profile (new) |
