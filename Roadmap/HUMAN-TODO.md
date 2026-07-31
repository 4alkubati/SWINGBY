# HUMAN TODO — only Kira can do these

**Last verified: 2026-07-31.** Everything on this list is blocked on an account,
a key, a payment, or a decision. Nothing here can be done by an agent.

Status values: **TODO** · **DONE** · **BLOCKED** · **DECIDE**

---

## Right now — blocks the Sunday build

| # | Status | Task |
|---|---|---|
| H1 | **TODO** | **Apply** `supabase/migrations/20260731120000_approval_gated_escrow_release.sql` in the Supabase SQL editor. One nullable column + one index, additive. |
| H2 | **TODO** | **Merge PR #81** (`gh pr merge 81 --squash`). **After H1** — Render deploys `main` and the new code reads that column. |
| H3 | **TODO** | Reveal `STRIPE_SECRET_KEY` in Render → Environment and read the first 8 chars. `sk_test_` = fine. `sk_live_` = **swap to test before submitting**, or the Apple reviewer's booking charges a real card. |

## Apple console — blocks TestFlight, not the dev build

| # | Status | Task |
|---|---|---|
| H4 | **DONE** | Apple Developer account active. Team ID `ZTYJ33HPDX` — recorded in `mobile/eas.json`. |
| H5 | **DONE** | Sign In with Apple capability on `com.swingby.app`. Verified working on device. |
| H6 | **DONE** | Supabase → Auth → Apple, bundle id in Client IDs, no secret key. |
| H7 | **TODO** | **App Store Connect → create the app record.** Name: **`SwingBy: Book Local Services`** — plain "SwingBy" is taken by 5 apps. English (Canada), bundle `com.swingby.app`, SKU `swingby-ios-001`. |
| H8 | **TODO** | From H7, send back the numeric **ascAppId** + the **Apple ID email**. `mobile/eas.json` still holds `REPLACE_WITH_*` for both. |
| H9 | **TODO** | **App Store Connect API key** — Users and Access → Integrations → App Manager → download the `.p8` (**one download, ever**), record Key ID + Issuer ID. This is what makes `eas submit` work from Windows with no Mac. |
| H10 | **TODO** | Confirm the **Paid Apps / Free agreement** is accepted under Agreements, Tax and Banking. |

## Decisions only you can make

| # | Status | Question |
|---|---|---|
| D1 | **DONE** | *Client goes quiet after work is done?* → **auto-release after 24 hours.** Implemented in PR #81. |
| D2 | **DECIDE** | **Legal entity name + registered address** for the privacy policy. This address becomes **public** — a registered/virtual Calgary address may beat your home one. Blocks publishing the canonical policy. |
| D3 | **DECIDE** | **Apple Pay** — worth registering a merchant ID and enabling it in Stripe? Needed before `merchantIdentifier` can be non-empty. Not a store blocker; is a conversion one. |
| D4 | **DECIDE** | **Card-on-file (M2)** — build SetupIntent + a manage-cards screen this cycle, or ship beta without saved cards? Currently a card is only retained as a side effect of paying once, and there is no UI to see or remove it. |
| D5 | **DECIDE** | **Payouts.** Nothing can actually pay a business today. Not an App Review blocker (nothing in the reviewed flow pays out) but it is a launch blocker. |

## Infrastructure

| # | Status | Task |
|---|---|---|
| H11 | **DONE** | `ENV=production` set in Render. `/health` confirms. |
| H12 | **TODO** | **Keep-warm depends on your home server.** The cron that stops Render sleeping runs from this Linux box every 10 min. If it is off during Apple's review, the reviewer hits a ~23s cold start. Leave it on for review week, or keep the "first request may take 30–60s" line in the review notes. |
| H13 | **TODO** | Decide whether `swingbyy.com` should serve `web/launch/` instead of the frozen `web/pre-launch/`. Cloudflare Pages production branch → `main`. Not a store blocker — a real privacy policy is already served. |

## Social — this weekend

| # | Status | Task |
|---|---|---|
| H14 | **TODO** | Confirm the handle to claim: **`swingbyyc`** (free on IG/FB/X/YT). `@swingbyapp` is taken by three other companies. |
| H15 | **TODO** | Create the accounts, or hand over credentials, before automation can post. |
| H16 | **DECIDE** | Automation route: **n8n** (visible, you already run it) or a **plain script** on the server cron. Cheaper and fewer moving parts is the script; n8n is easier for you to see and edit. |

---

## Recently closed

- ~~Apple Developer enrolment~~ — done.
- ~~Sign in with Apple entitlement~~ — done, working on device.
- ~~Services ID / domain registration~~ — **not needed.** Native id-token flow;
  the doc that demanded it was wrong and has been corrected.
- ~~`ENV=production`~~ — done.
- ~~UGC migration (PR #80)~~ — applied.
- ~~24h auto-release decision~~ — answered, built.
