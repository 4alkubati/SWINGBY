# HUMAN TODO — only Kira can do these

**Last verified: 2026-07-31.** Everything on this list is blocked on an account,
a key, a payment, or a decision. Nothing here can be done by an agent.

Status values: **TODO** · **DONE** · **BLOCKED** · **DECIDE**

---

## Right now — blocks the Sunday build

| # | Status | Task |
|---|---|---|
| H1 | **DONE** | ~~Apply TWO migrations in the Supabase SQL editor.~~ **Verified twice, independently:** `information_schema.columns` on 2026-08-01, and a direct PostgREST probe on 2026-08-03 — `bookings.approval_deadline_at` → 200, `users.terms_accepted_at` → 200. Every other filed migration was probed at the same time (`content_reports`, `user_blocks`, `messages.hidden_at`, `payments.post_id`) — all live. Probed, never read from a migration header; those have lied three times. |
| H2 | **DONE** | ~~Merge PR #81.~~ Merged 2026-07-31, along with #82–#85. Render reports `environment: production` and `/health` is green. |
| H3 | **DONE** | ~~Check `STRIPE_SECRET_KEY` in Render.~~ **Kira verified 2026-08-03: it is a test key.** Note for anyone re-checking: `/health` reporting `stripe: ok` proves the key *parses*, not which mode it is in — the only proof is reading the prefix. Payments stay in sandbox for the whole beta. |

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
| D3 | **PARTLY ANSWERED** | **Apple Pay.** Google Pay is **built, on, and needs nothing from you** (`enableGooglePay: true`; Stripe's own merchant id covers it). Apple Pay is **code-complete and waiting on one account-side value**: the app reads the merchant id from the *server* response, so the wallet turns on with no app rebuild — but the iOS entitlement is gated on the build-time `STRIPE_MERCHANT_IDENTIFIER`. **Decision left: register an Apple merchant ID and set that env var, or ship beta with Google Pay + card only.** |
| D4 | **ANSWERED — BUILT** | ~~Card-on-file (M2).~~ Shipped in PR #83 and **genuinely wired**: SetupIntent endpoints, `services/cards.js`, and `PaymentMethodScreen` registered in **both** navigators and reachable from Profile, Business profile, QuoteComparison, BookingDetails and PostJob. This one did not repeat the built-but-never-wired pattern. |
| D5 | **DECIDE** | **Payouts.** Nothing can actually pay a business today. Not an App Review blocker (nothing in the reviewed flow pays out) but it is a launch blocker. |
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
