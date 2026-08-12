# SwingBy Marketing & Monetization

This folder is the **strategy and copy library** for everything Swingbyy needs to go from "the product is built" to "people are paying us."

It is owned by the founder (Amr) and is updated at the end of every marketing/business sprint.

> ## ⚠️ `FACTS.md` outranks every file in this folder
>
> **If a claim is not on that page, it does not ship.** Not a softened version,
> not a hedged version, not "something like."
>
> **There is exactly one FACTS.md and it is not in this repo.** It lives at
> `agents/hermes/roles/FACTS.md` in the brain, which is what the hermes worker
> reads at generation time. Do not copy it here. A second copy with a note saying
> "keep these in sync" is a convention, and a convention is not a guard — it is
> the same drift mechanism this folder exists to stop. `tools/claim_lint.py`
> fails the build if a copy reappears and diverges.
>
> This is not a formality. The 50/50 staged-release claim was killed on
> 2026-07-29, again on 07-31, again on 08-01 (PR #86, *"The 50/50 claim was not
> dead"*), and again on 08-11 — and it was **still in `MARKETING-PLAN.md`** when
> this folder was swept on 2026-08-12. Every one of those fixes patched a single
> file and moved on.
>
> **The propagation failure is one layer below the prose.** As of 2026-08-12 the
> brain's `FACTS.md` is ~40 KB in the working tree on the box and **6,321 bytes
> committed** — every correction since 08-04 was written and never committed. So
> a fresh clone reads a FACTS that still says escrow *"auto-releases after 24
> hours"*, a claim the current §2.1 bans by name. The same is true of the
> hermes `studio/` tree, which is untracked entirely — including `queue.json`,
> which holds captions that publish **verbatim** along with their claim audits,
> and exists on exactly one machine.
>
> Fixing prose in this folder does nothing about either. **Commit the brain.**

---

## What lives here

| File | Purpose |
|---|---|
| ⚠️ `agents/hermes/roles/FACTS.md` **(in the brain, not here)** | **The claim boundary — read this before writing a word.** What is true, what is banned, and the open `NEEDS-FACT` questions that block whole topics |
| [01-monetization-strategy.md](01-monetization-strategy.md) | How Swingbyy makes money — primary, secondary, future revenue streams |
| [02-pricing.md](02-pricing.md) | Take rate, fees, subscription tiers, promotional pricing, unit economics |
| [03-go-to-market.md](03-go-to-market.md) | Calgary launch playbook — who we target first, how we get them on |
| [04-positioning-and-messaging.md](04-positioning-and-messaging.md) | One-liner, value props, audience-specific messaging, competitor framing |
| [05-launch-checklist.md](05-launch-checklist.md) | Day-0 through Day-30 launch checklist (app stores, website, PR, support) |
| [06-growth-playbook.md](06-growth-playbook.md) | Acquisition channels, referral mechanics, SEO, paid, partnerships |
| [07-content-calendar.md](07-content-calendar.md) | 90-day content plan — blog, social, email |
| [08-kpis-and-metrics.md](08-kpis-and-metrics.md) | North-star metric, weekly dashboard, cohort tracking |
| [09-brand-guidelines.md](09-brand-guidelines.md) | Voice, tone, logo, color, typography rules for everything we publish |
| [10-partnerships.md](10-partnerships.md) | Strategic partners (chambers of commerce, trade schools, suppliers) |
| [11-n8n-social-workflow.md](11-n8n-social-workflow.md) | n8n social workflow design spec — ⚠️ describes workflows as built that are **not** running; see [14](14-automation-stack.md) |
| [11b-ads-plan.md](11b-ads-plan.md) | Paid media plan — budgets, creative testing, channel split |
| [11c-customer-acquisition.md](11c-customer-acquisition.md) | Acquisition motion for each side of the marketplace |
| [12-social-media-playbook.md](12-social-media-playbook.md) | Day-to-day social operating manual, per platform |
| [13-accounts-and-identity.md](13-accounts-and-identity.md) | **Domain, mailbox, and social account registry.** Which domains we own, every `@swingbyy.com` address, which email signs up for what |
| [14-automation-stack.md](14-automation-stack.md) | **What's actually running** (n8n, Telegram), the reply-bot design, funnel + image pipeline, costs, build order |
| [15-tips-and-workarounds.md](15-tips-and-workarounds.md) | **The full operating list** — growth tips translated to a local marketplace, free-path workarounds, what not to do |
| [16-funnel-map.md](16-funnel-map.md) | How social feeds the product, drawn as **two** funnels — supply and demand — instead of one |
| [17-social-media-registry.md](17-social-media-registry.md) | **Every social account in one table** — what exists, what's taken by other companies, handle availability, owner emails, and the real subscription bill |
| `assets/` | Logos, screenshots, demo videos, press kit (folder created when assets exist) |
| `campaigns/` | One subfolder per launched campaign with brief + results |

---

## How to use this folder

1. **Before writing any public copy** — read [FACTS.md](FACTS.md). It outranks
   everything below it, including this file.
2. **Before any marketing decision** — read the relevant file. Don't reinvent.
3. **After any marketing experiment** — update the relevant file with what worked and what didn't.
4. **When asked "how do we make money?"** — open `01-monetization-strategy.md`. That's the answer.
5. **Before a claim goes public** — `python tools/claim_lint.py`. It greps this
   folder for the banned set and exits non-zero on a hit.

---

## Canonical identity

**The wordmark is `Swingbyy`** — capital S, everything else lowercase, two y's
(FACTS §0). `SwingBy` is the dead one-y name. The domain and handles stay
lowercase (`swingbyy.com`, `@swingbyy`) because those are addresses, not the
wordmark.

**The domain is `swingbyy.com`** (double-y). We do not own `swingby.com`, `swingby.ca`, or `swingby.app` — all three are registered to third parties. **`swingbyapp.com` is unregistered — we do not own it either, so never print it as a URL**; it and `.ca` should be bought defensively. Every public address is `@swingbyy.com`; `amr@swingbyy.com` is the founder login and is never published. Full detail and evidence in [13-accounts-and-identity.md](13-accounts-and-identity.md).

---

## Status (2026-08-12)

- Backend: ✅ Built
- Web pre-launch site: 🟡 **Source fixed, deployment unverified.** PR #130 removed the invented insurance claims, and `TermsPage.jsx:26` now carries the **correct** cancellation ladder (full refund >48h, 75/25 inside 48h, 50% after the date, provider cancels = full refund). PR #135 added a deploy gate. What is not verified from this repo is whether **the live site has actually served that build yet** — FACTS §5.1's blocker was about the deployed bundle, not the source, and it is settled only by checking production. Until someone does, treat a website CTA as unconfirmed.
  - Still wrong in that source: `TermsPage.jsx:35` claims a **"Verified" badge** (§4 — no verification flow exists). `web/` has 150 open claim-lint hits overall and has not been swept.
- Mobile app: 🟡 Built. Payments run in **Stripe sandbox** — no real money has moved (FACTS §5)
- Marketing plan: 🟡 Drafted, reconciled against FACTS on 2026-08-12
- Money in the door: ❌ Not yet

**Launch:** App Store listing **Oct 1–10, 2026**. TestFlight before that. The old
Aug 31 date is dead — never cite it (FACTS §5).  <!-- lint-ok -->

**Correct CTAs right now:** join the waitlist · follow for updates · Calgary
businesses — early access.
