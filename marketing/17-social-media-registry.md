---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market, ops, social]
---
# 17 — Social Media Registry

> **Handle decision, 2026-08-04 (Kira):** the name is **`swingbyy`** everywhere — `@swingbyy` on X and Instagram, `/swingbyy` on LinkedIn — with the single exception of **TikTok, which is `@swingbyyy`** (three y's) because that is what was claimed. The earlier `swingbyyc` recommendation is dead; every reference in this repo was updated.

> Everything social in one table: what exists, what doesn't, which email owns it, what it costs. Probed against the live platforms on **2026-07-30**. This page supersedes the social account table in [13-accounts-and-identity.md](13-accounts-and-identity.md), which assumed nothing had been claimed.

Related: [12-social-media-playbook.md](12-social-media-playbook.md) · [13-accounts-and-identity.md](13-accounts-and-identity.md) · [14-automation-stack.md](14-automation-stack.md)

---

## The master table

Every social-related thing SwingBy has or needs, in one place. Legend: ✅ live · ⚠️ exists but unverified · ❌ nothing yet · 🚫 held by another company

| # | Item | Type | What we have today | What we need | Handle / address | Login email | Cost | Priority |
|---|---|---|---|---|---|---|---|---|
| 1 | **Instagram** | Channel | ✅ **CLAIMED** — `@swingbyy`. Profile read 2026-08-04: **display name is "AMR"**, 1 follower, **0 posts**. `@swingbyapp` belongs to someone else. | ⚠️ **Rename to `SwingBy Calgary`** (it currently says "AMR"), add the bio, **convert to a Business account** — required for the Graph API | `@swingbyy` | ⚠️ **confirm** | **Free** | ✅ claimed |
| 2 | **Facebook Page** | Channel | ❌ Nothing — `/swingbyy` probed **free** 2026-08-04. `/SwingByApp` is *SwingBy, Markham ON*, a food-deals business, 17 likes | Create the Page at `/swingbyy`. **Blocks all Instagram automation** — the Graph API needs a linked Page | `/swingbyy` | `amr@swingbyy.com` | **Free** | **P0** |
| 3 | **Meta Business Suite** | Platform | ❌ Nothing | Create it, link IG + FB, add a 2nd admin | — | `amr@swingbyy.com` | **Free** | **P0** |
| 4 | **Google Business Profile** | Channel | ❌ Nothing | Create + verify (postcard takes ~1 week — start early) | SwingBy Calgary | `amr@swingbyy.com` | **Free** | **P0** |
| 5 | **TikTok** | Channel | ✅ **CLAIMED** — `@swingbyyy`, three y's. ⚠️ Not independently verifiable: TikTok blocks unauthenticated probes, returning an identical 1,462-byte shell for every handle including ones that don't exist | Confirm the registered email, then bio + link. **Re-check in the app whether `swingbyy` is genuinely taken** — one platform spelled differently breaks cross-promotion | `@swingbyyy` | ⚠️ **confirm** | **Free** | ✅ claimed |
| 6 | **LinkedIn Page** | Channel | ❌ **Nothing yet** — `/company/swingbyy` probed **404**, so it is free. `/company/swingbyapp` is a different rideshare/errand company. | **Create the Page at `/swingbyy`** — the only handle still outstanding | `/swingbyy` | `amr@swingbyy.com` | **Free** | **P0** |
| 7 | **X / Twitter** | Channel | ✅ **CLAIMED** — `@swingbyy`. Profile read 2026-08-04: **display name is "Swing"**, 1 follower, 53 following, joined Jun 2026. `@SwingByApp` is *SwingBy UG*, German, dormant since 2018. | ⚠️ **Rename to `SwingBy Calgary`** (it currently says "Swing"), add the bio | `@swingbyy` | ⚠️ **confirm** | **Free** | ✅ claimed |
| 8 | **YouTube** | Channel | ❌ Nothing — `@swingbyy` probed **404**, confirmed free 2026-08-04 | Claim `@swingbyy` | `@swingbyy` | `amr@swingbyy.com` | **Free** | P2 |
| 9 | **Reddit** | Channel | ❌ Nothing | Claim `u/swingbyy`; read r/Calgary for 30 days before posting | `u/swingbyy` | `amr@swingbyy.com` | **Free** | P2 |
| 10 | **Telegram bot** | Ops | ✅ **Live** — `@L3thallbot`, responds to `getMe` | Nothing | existing | — | **Free** | ✅ done |
| 11 | **Discord** | Ops | ❌ Nothing on the box | Server + `#inbox` `#approvals` `#alerts`, wired via the n8n Discord node | SwingBy Ops | `amr@swingbyy.com` | **Free** | P1 |
| 12 | **n8n** | Tool | ✅ **Self-hosted** — container `swingby-n8n`, port 5678, up 24h, 1 workflow | Build the social + DM workflows | — | — | **$0** | P1 |
| 13 | **Claude API** | Tool | ❌ Not wired into n8n | Haiku 4.5 for DM replies, Sonnet 5 for captions | — | `amr@swingbyy.com` | **~$5/mo** | P1 |
| 14 | **Canva** | Tool | ❌ Not set up | Free tier — Pro only adds brand kit + bg removal | — | `amr@swingbyy.com` | **$0** | P1 |
| 15 | **CapCut** | Tool | ❌ Not set up | Free — includes auto-captions | — | `amr@swingbyy.com` | **$0** | P1 |
| 16 | ~~Buffer~~ | Tool | — | ❌ **Don't buy** — n8n already does scheduling | — | — | ~~$15/mo~~ | skip |
| 17 | ~~Descript~~ | Tool | — | ❌ **Don't buy** — CapCut captions free | — | — | ~~$12/mo~~ | skip |
| 18 | ~~Linktree~~ | Tool | — | ❌ **Don't use** — we own `swingbyy.com` and keep the analytics | — | — | ~~$0–5/mo~~ | skip |
| 19 | `amr@swingbyy.com` | Email | ❌ **No routing rule yet** | Add it at Cloudflare — it's the login for rows 1–15 | never published | → `4alkubati@gmail.com` | **Free** | **P0** |
| 20 | `hello@swingbyy.com` | Email | ✅ **Live** — also the Resend `From` | Nothing | in every bio | → `4alkubati@gmail.com` | **Free** | ✅ done |
| 21 | `support@swingbyy.com` | Email | ⚠️ Documented, not routed | Add the routing rule — DMs escalate here | app + web | → `4alkubati@gmail.com` | **Free** | **P0** |
| 22 | `press@swingbyy.com` | Email | ⚠️ Documented, not routed | Add rule; put on the link page, not the bio | press kit | → `4alkubati@gmail.com` | **Free** | P1 |
| 23 | `partnerships@swingbyy.com` | Email | ⚠️ Documented, not routed | Add rule — chambers of commerce, trade schools | partnerships page | → `4alkubati@gmail.com` | **Free** | P1 |
| 24 | `privacy@` `legal@` `security@` | Email | ⚠️ Documented, not routed | Add rules — these are cited in the legal docs and the app | required public | → `4alkubati@gmail.com` | **Free** | **P0** |
| 25 | `billing@swingbyy.com` | Email | ⚠️ Documented, not routed | Add rule — ad-platform receipts | internal | → `4alkubati@gmail.com` | **Free** | P1 |
| 26 | **`www.swingbyy.com`** | Infra | ❌ **Does not resolve** (apex returns 200) | `CNAME www → swingbyy.com`, proxied. **Meta App Review needs a reachable privacy URL** | — | — | **Free** | **P0** |
| 27 | DMARC `rua=` | Infra | ⚠️ `p=none`, no `rua=` — nobody gets reports | Add `rua=mailto:dmarc-reports@swingbyy.com` | — | — | **Free** | P1 |
| 28 | Defensive domains | Infra | ❌ `swingbyapp.com` / `.ca` unregistered | Register + park → `swingbyy.com` | — | `amr@swingbyy.com` | **~$25/yr** | P2 |
| 29 | Paid ads | Spend | ❌ Nothing running | Gated behind M1 — organic first | — | `amr@swingbyy.com` | **$0 now** | ⏸️ hold |

**Totals: every platform and every mailbox is free. The only recurring cost is ~$5/mo for the Claude API**, plus an optional ~$25/yr for defensive domains. Rows 16–18 are things the older docs recommended that would have added **$27+/mo** for capability we already have.

---

## Read this first: the name is contested

`@swingbyapp` — the handle the whole plan was built around — **is taken on four platforms by three different companies that are not us.**

| Where | Who actually holds it | Evidence |
|---|---|---|
| Facebook `/SwingByApp` | **SwingBy, Markham ON** — a food-deals business, 17 likes, tagline *"Your Meal Our Deal!"* | Page title `SwingBy \| Markham ON` |
| X `@SwingByApp` | **SwingBy UG** — a German company (UG = Unternehmergesellschaft), 0 followers, joined Jan 2018, dormant | Profile title `SwingBy UG (@SwingByApp) / X` |
| LinkedIn `/company/swingbyapp` | **SwingBy** — a rideshare/errand-sharing platform, 2 followers: *"connecting people who are already headed the same way"* | Company og:description |
| Instagram `@swingbyapp` | **Unidentified** — display name "SwingBy", **1,836 followers · 3,058 following · 159 posts** | og:description on the public profile |

Plus the domains, from [13-accounts-and-identity.md](13-accounts-and-identity.md), now with live page titles:

| Domain | Who | Title served today |
|---|---|---|
| `swingby.com` | Third party | *Savannah Jazz Festival* |
| `swingby.app` | Third party | *Swingby: ontdek limburg en boek de leukste arrangementen* (Dutch tourism) |
| `swingby.ca` | Third party | *swingby.ca* (parked) |
| `swingbyy.com` | ✅ **Ours** | The SwingBy site |

**On the Instagram account — I could not confirm ownership either way.** It is real and worked (159 posts is not a squat), and the 3,058-following-to-1,836-follower ratio is the signature of follow-for-follow growth. It may be a SwingBy account someone set up, or it may be a fourth unrelated company. **Check whether you can log into it before doing anything else on this page** — if it's ours, 1,836 followers is a genuine asset and the handle question is settled; if it isn't, every "claim the handle" line below applies.

> This is the one blocking question on the whole social plan. Everything else has a clear answer.

---

## What we have vs. what we need

Legend: ✅ live · ⚠️ exists but unverified/blocked · ❌ nothing · 🚫 taken by someone else

| Platform | Status today | Handle to use | Owner email | Subscription | Priority | What it's for |
|---|---|---|---|---|---|---|
| **Instagram** | ⚠️ `@swingbyapp` exists, ownership unconfirmed | `@swingbyapp` if ours, else `@swingbyy` | `amr@swingbyy.com` | **Free** | **P0** | Primary channel. Before/after content is the whole pitch. |
| **Facebook Page** | 🚫 `/SwingByApp` = Markham food business | `/swingbyy` (free) | `amr@swingbyy.com` | **Free** | **P0** | Required for Meta Business + the Instagram API. Calgary neighbourhood groups are where clients are. |
| **Meta Business Suite** | ❌ Not created | — | `amr@swingbyy.com` | **Free** | **P0** | Container for IG + FB + ads + the Graph API tokens n8n needs. |
| **Google Business Profile** | ❌ Not created | SwingBy | `amr@swingbyy.com` | **Free** | **P0** | Highest-intent local surface there is, and it's free. Feeds hyperlocal SEO. |
| **TikTok** | ⚠️ Unverifiable — TikTok blocks server-side probes | `@swingbyyy` (check in-app) | `amr@swingbyy.com` | **Free** | P1 | 30-day scripts already written in `content-library/tiktok-30-day-scripts.md`. |
| **LinkedIn Page** | 🚫 `/swingbyapp` = rideshare company | `/swingby-yyc` or `/swingbyy` | `amr@swingbyy.com` | **Free** | P1 | Supply side — recruiting businesses, not clients. |
| **X/Twitter** | 🚫 `@SwingByApp` = SwingBy UG (dormant) | `@swingbyy` (free) | `amr@swingbyy.com` | **Free** | P2 | Low ROI for local services. Claim it, post rarely. |
| **YouTube** | ❌ `@swingbyapp` free, all candidates free | `@swingbyyy` | `amr@swingbyy.com` | **Free** | P2 | Long-form home; feeds Shorts/Reels/TikTok. |
| **Telegram bot** | ✅ **Live** — `@L3thallbot`, responds to `getMe` | existing | — | **Free** | ✅ done | Push channel: morning brief, alerts, tap-to-copy commands. |
| **Discord** | ❌ Nothing on the box | SwingBy Ops | `amr@swingbyy.com` | **Free** | P1 | Private ops console (`#inbox`/`#approvals`/`#alerts`), not a community. |
| **Reddit** | ❌ Not created | `u/swingbyy` | `amr@swingbyy.com` | **Free** | P2 | r/Calgary is strict — read-only for 30 days before ever posting. |

**Every social platform on this list is free.** There is no social subscription to buy at any point in this plan.

---

## Handle availability — probed 2026-07-30

Verified by fetching each public profile URL and reading the page title. A generic title (`Instagram`, `Facebook`) or a 404 means the handle is unclaimed.

| Handle | Instagram | Facebook | X | YouTube | LinkedIn | Verdict |
|---|---|---|---|---|---|---|
| `swingby` | 🚫 taken | — | — | — | — | Gone |
| `swingbyapp` | 🚫 taken | 🚫 Markham | 🚫 SwingBy UG | ✅ free | 🚫 rideshare | Dead as a cross-platform identity |
| `swingbyhq` | 🚫 taken | — | — | — | — | Gone |
| **`swingbyy`** | ✅ **free** | ✅ **free** | ✅ **free** | ✅ **free** | ✅ free | ⭐ **Clean sweep — take it** |
| `getswingby` | ✅ free | ✅ free | ✅ free | ✅ free | — | Clean sweep, second choice |
| `swingbycalgary` | ✅ free | ✅ free | ✅ free | ✅ free | — | Clean sweep, but long |
| `useswingby` | ✅ free | — | — | — | — | Backup |
| `tryswingby` | ✅ free | — | — | — | — | Backup |
| `swingby_yyc` | ✅ free | — | — | — | — | Backup (underscores read as spam) |

**Recommendation: `swingbyy` on every platform.** It's free everywhere tested, it's the shortest of the clean options, and `yyc` is Calgary's airport code — locally legible, and it distinguishes us from the Markham, German, and rideshare SwingBys without inventing a new word. Claim all five today even if nothing gets posted for a month; a handle lost to a squatter on a launching brand is unrecoverable.

*Caveat: TikTok blocks unauthenticated profile requests — every handle returned an identical 1,462-byte shell. Check TikTok handles inside the app.*

---

## Email map — which address owns what

All aliases are Cloudflare Email Routing on `swingbyy.com`, forwarding free to `4alkubati@gmail.com`. Full mailbox map in [13-accounts-and-identity.md](13-accounts-and-identity.md).

| Address | Used for | Published? | Status |
|---|---|---|---|
| **`amr@swingbyy.com`** | **Every social login, ad account, Meta Business, app store, Stripe** | ❌ **never** | ⚠️ routing rule not yet added |
| `hello@swingbyy.com` | The public contact in every bio and the Resend `From` | ✅ bios, footer | ✅ **live** |
| `support@swingbyy.com` | Where DMs escalate when the bot can't answer | ✅ app + web | ⚠️ not yet routed |
| `press@swingbyy.com` | Media enquiries — put it in the IG bio link page, not the bio | ✅ press kit | ⚠️ not yet routed |
| `partnerships@swingbyy.com` | Inbound from chambers of commerce, trade schools | ✅ partnerships page | ⚠️ not yet routed |
| `privacy@` `legal@` `security@` | Cited in the legal docs and the app | ✅ required | ⚠️ not yet routed |
| `billing@swingbyy.com` | Ad-platform receipts and invoices | ❌ internal | ⚠️ not yet routed |

**Two rules, both non-negotiable:**

1. **One login address for everything: `amr@swingbyy.com`.** Never a role alias — `support@` and `hello@` get forwarded and eventually shared, and a login that lands in a shared inbox is a login that leaks.
2. **`amr@` is never published.** Public contact is `hello@` or `support@`. A personal Gmail on a marketplace's contact page invites scraping — and `4alkubati@gmail.com` / `amrbasem37@gmail.com` currently appear ~590 times across the vault.

---

## Tooling and subscriptions — what to actually pay for

The vault's older docs quote a tool stack costing **$67/month**. Most of it is redundant with what's already running on the server.

| Tool | Purpose | Older docs say | **Verdict** | Real cost |
|---|---|---|---|---|
| **n8n** | Scheduling, cross-posting, DM routing, the whole funnel | $6–20/mo (Cloud) | ✅ **Already self-hosted** — container `swingby-n8n`, up 24h, port 5678 | **$0** |
| **Claude API** | DM replies (Haiku) + caption generation (Sonnet) | GPT-4o | ✅ **Use this** — swap the OpenAI nodes | **~$5/mo** |
| **Telegram Bot** | Push alerts, approvals | — | ✅ **Live** (`@L3thallbot`) | **$0** |
| **Discord** | Ops console with channels + buttons | — | ✅ **Build** via the n8n Discord node | **$0** |
| **CapCut** | Video editing for Reels/TikTok | Free | ✅ Use it | **$0** |
| **Canva** | Carousels, graphics, thumbnails | Free / $15/mo Pro | ✅ **Free tier is enough** — Pro only buys brand kit + background remover | **$0** |
| **Buffer** | Post scheduling | $15/mo | ❌ **Don't buy** — n8n already does this, and Buffer is the thing n8n replaced | **$0** |
| **Descript** | AI video captioning | $12/mo | ❌ **Don't buy** — CapCut auto-captions free | **$0** |
| **Linktree** | Link-in-bio | mentioned as an option | ❌ **Don't use** — we own `swingbyy.com`; one less dependency and we keep the analytics | **$0** |
| **Meta Business Suite** | IG + FB scheduling, inbox, ads | — | ✅ Use it | **$0** |
| **Google Business Profile** | Local search presence | — | ✅ Use it | **$0** |
| Defensive domains | `swingbyapp.com` + `.ca` parked → `swingbyy.com` | — | ⚠️ Optional but cheap insurance | **~$25/yr** |
| Paid ads | Google branded, then Meta | $0 → $3k/mo over 12 weeks | ⏸️ **Not yet** — gated behind M1 | **$0 now** |

**Total recurring social + marketing spend: ~$5/month** (the Claude API), against the ~$67/month the older docs imply. Everything else is free tier or already running. This holds to the no-paid-subscriptions rule until launch economics justify otherwise.

---

## What each platform needs before it can be automated

| Platform | Automation prerequisite | Difficulty |
|---|---|---|
| Instagram DMs + posting | Business account → linked to a **Facebook Page** → Meta Business Suite → app with `instagram_manage_messages` → **App Review** | 🔴 Hard — App Review takes days-to-weeks and needs a working privacy policy URL |
| Facebook Page | Same Meta app; Page tokens | 🟠 Medium |
| TikTok | Content Posting API needs developer approval | 🟠 Medium |
| X | Free tier allows posting, not reading | 🟢 Easy |
| YouTube | Data API v3, OAuth, free quota | 🟢 Easy |
| LinkedIn | Company page posting needs app review | 🟠 Medium |
| Telegram | ✅ Already working | 🟢 Done |
| Discord | Webhook URL, no review | 🟢 Easy |

**The critical path is Meta.** Instagram automation cannot start until a Facebook Page exists, is linked to a Business account, and an app clears review — and App Review requires a **live, resolving privacy policy URL**. Note that `www.swingbyy.com` **still returns nothing** (confirmed again today; the apex returns 200). Fix the `www` CNAME before submitting anything to Meta, or the review fails on a technicality.

---

## Human-only steps, in order

Nobody but Amr can do these — they need logins, a phone, or a credit card. ✅ = already done.

1. ✅ **Claim `@swingbyy` on Instagram and X, `@swingbyyy` on TikTok.** Done 2026-08-04.
2. ✅ **Settle whether `@swingbyapp` is ours.** It isn't — ours is `@swingbyy`. Never link to `@swingbyapp`.
3. **Fix the display names.** Instagram currently reads **"AMR"**, X reads **"Swing"**. Both should be `SwingBy Calgary`, with the bio below. Highest-value five minutes on this list: the accounts are live and neither says what the company is.
4. **Convert Instagram to a Business account.** Prerequisite for the Graph API — every automation plan is blocked until this is done.
5. Cloudflare → Email → add the routing rule for **`amr@swingbyy.com`** (the login address for every account, and it still doesn't exist).
6. Cloudflare → DNS → add `CNAME www → swingbyy.com`, proxied. **Still dead** — and Meta App Review needs a reachable privacy-policy URL.
7. Claim **`swingbyy`** on **Facebook, YouTube and LinkedIn** — all three probed free on 2026-08-04. Squatting is unrecoverable; claim now, post later.
8. Re-check `swingbyy` on **TikTok in the app** — server-side probing can't tell claimed from unclaimed. If it's free, switch off the triple-y.
9. Create the **Facebook Page** → link it to Instagram in **Meta Business Suite**.
10. Create the **Google Business Profile** and verify it (postcard takes ~a week — start it early).
11. Turn on **app-based 2FA** everywhere — not SMS. SIM-swap is the standard attack on a founder with a payment processor.
12. **Add a second admin to the Meta Business account.** A Page with one admin is one account-lock away from gone.
13. Put the recovery codes in a password manager.

---

## The bio — identical everywhere

```
SwingBy — Calgary's local services marketplace.
Post a job free. Get bids from nearby pros. Pay safely.
swingbyy.com
```

Link target: `https://swingbyy.com`. Not a Linktree.

Given three other companies use this name, add **Calgary** to every display name (`SwingBy Calgary`) so search and tagging disambiguate us from the Markham food page and the German UG. **Neither live account does this yet** — Instagram says "AMR", X says "Swing".

---

## Intake — what has actually happened

Everything above is what we *should* do. This table is what has *been done*. Update it from evidence, not from the plan — a row is not done because a page says it should be.

**No passwords, tokens, or recovery codes in this file, ever.** Those live in a password manager.

| Item | Handle / value | Login email on file | Status | Date |
|---|---|---|---|---|
| Instagram | **`@swingbyy`** | ⚠️ unconfirmed | ✅ claimed — display name "AMR", 0 posts, not yet a Business account | 2026-08-04 |
| X / Twitter | **`@swingbyy`** | ⚠️ unconfirmed | ✅ claimed — display name "Swing" | 2026-08-04 |
| TikTok | **`@swingbyyy`** | ⚠️ unconfirmed | ✅ claimed — re-check if `swingbyy` is free there | 2026-08-04 |
| Is `@swingbyapp` ours? | **No** | — | ✅ answered — belongs to another company | 2026-08-04 |
| Facebook Page | `/swingbyy` — probed free | | ❌ | |
| YouTube | `@swingbyy` — probed free | | ❌ | |
| LinkedIn Page | `/company/swingbyy` — probed free | | ❌ | |
| Meta Business Suite | — | | ❌ | |
| Google Business Profile | | | ❌ | |
| Reddit | `u/swingbyy` | | ❌ | |
| Discord — SwingBy Ops | — | | ❌ | |
| `amr@swingbyy.com` routing rule | — | → `4alkubati@gmail.com` | ❌ | |
| Other aliases routed | `support@ privacy@ legal@ security@ press@ partnerships@ billing@` | → `4alkubati@gmail.com` | ❌ | |
| `www` CNAME | `www → swingbyy.com`, proxied | — | ❌ **still dead** | |

The three ⚠️ rows matter: nobody has confirmed which email address those accounts were registered under. If they went in on a personal Gmail, they should move to `amr@swingbyy.com` before the account list grows — see the `amr@` rule in [13-accounts-and-identity.md](13-accounts-and-identity.md).
