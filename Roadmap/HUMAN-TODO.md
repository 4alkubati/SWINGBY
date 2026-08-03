# HUMAN TODO — only Kira can do these

**Last verified: 2026-07-31.** Everything on this list is blocked on an account,
a key, a payment, or a decision. Nothing here can be done by an agent.

Status values: **TODO** · **DONE** · **BLOCKED** · **DECIDE**

---

## Right now — blocks the Sunday build

| # | Status | Task |
|---|---|---|
| H1 | **DONE** | ~~Apply TWO migrations in the Supabase SQL editor.~~ **Both verified applied 2026-08-03** by probing PostgREST directly (never the migration headers — they lie): `bookings.approval_deadline_at` → 200, `users.terms_accepted_at` → 200. Every other filed migration was probed at the same time (`content_reports`, `user_blocks`, `messages.hidden_at`, `payments.post_id`) — all live. |
| H2 | **DONE** | ~~Merge PR #81.~~ Merged 2026-07-31. |
| H3 | **DONE** | ~~Check `STRIPE_SECRET_KEY` in Render.~~ **Kira verified 2026-08-03: it is a test key.** Payments stay in sandbox for the whole beta, so this stays true until someone deliberately changes it. |

## Apple console — blocks TestFlight, not the dev build

> **DEFERRED by Kira, 2026-08-03** — the App Store Connect record and the Apple IDs
> wait until everything else is verified; the current loop runs on the installable
> **preview** build, not TestFlight. H7–H10 below stay open but are **not** this
> week's work. *(Read back from a short instruction — correct me if the intent was
> different.)*

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
| D2 | **PART-ANSWERED** | **Legal entity = `4alkubati`** (Kira, 2026-08-03). **Address still open** — he is working on it. This address becomes **public**, so a registered/virtual Calgary address likely beats the home one. The canonical policy cannot be published until the address exists; the *deployed* policy is unaffected and already live. |
| D3 | **DECIDE** | **Apple Pay** — worth registering a merchant ID and enabling it in Stripe? Needed before `merchantIdentifier` can be non-empty. Not a store blocker; is a conversion one. |
| D4 | **ANSWERED — BUILD** | **Card on file must be there** (Kira, 2026-08-03). The endpoints already exist on `main` (`POST /payments/setup-intent`, `GET`/`DELETE /payments/payment-methods`, `default_payment_method_id` written) — what is missing is the **manage-cards UI** and wiring the saved card into the pay sheet so a repeat booking does not re-enter a card. |
| D5 | **ANSWERED — INSTANT** | **A business must be able to take its money out instantly** (Kira, 2026-08-03). That means **Stripe Connect** (Express accounts) + **instant payouts** to a debit card, not manual transfers. Nothing pays out today; the ledger records `released_to_business` and stops there. This is the largest unbuilt piece of money work and needs onboarding/KYC, a payout endpoint and a Wallet screen. Still not an App Review blocker — nothing in the reviewed flow pays out. |
| D6 | **DECIDE** | **Credit redemption.** `credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED` is **off**, so a $25 goodwill credit can be granted, and now *seen* in Settings, but not spent. Turning it on needs the charge path verified in Stripe test mode end-to-end, and has a known hole (an abandoned checkout keeps the credit spent). Until then the app tells the holder to contact you. |

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
| H15 | **TODO** | Create the accounts and put the tokens in `backend/../.env.social` (gitignored). `python tools/social_post.py --check` prints exactly which variables are still missing. **This is the only thing standing between us and the two posts being live** — the copy and the publisher are done. |
| H16 | **ANSWERED** | **Plain script.** `tools/social_post.py` — one command, all platforms, dry-run by default, 10 tests in CI. n8n was *designed* (43 nodes across 3 workflows, `marketing/11-n8n-social-workflow.md`) and its own first paragraph says it uses placeholder credentials and has never run: it needs Notion, OpenAI, Slack and Buffer wired before one post goes out. Two posts do not need an approval gate and a GPT caption writer. If you want the visible version later, n8n can call this script from one Execute Command node — nothing here blocks that. |
| H17 | **TODO** | **"Link in bio" needs a working link.** `swingbyy.com` is still the frozen pre-launch site and the app is not on the App Store. Until one is true the posts say "join the waitlist", not "download the app". Decide which. |

---

## Recently closed

- ~~Apple Developer enrolment~~ — done.
- ~~Sign in with Apple entitlement~~ — done, working on device.
- ~~Services ID / domain registration~~ — **not needed.** Native id-token flow;
  the doc that demanded it was wrong and has been corrected.
- ~~`ENV=production`~~ — done.
- ~~UGC migration (PR #80)~~ — applied.
- ~~24h auto-release decision~~ — answered, built.
