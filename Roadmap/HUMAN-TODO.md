# HUMAN TODO — only Kira can do these

**Last verified: 2026-07-31.** Everything on this list is blocked on an account,
a key, a payment, or a decision. Nothing here can be done by an agent.

Status values: **TODO** · **DONE** · **BLOCKED** · **DECIDE**

---

## Right now — the live blockers (updated 2026-08-04)

| # | Status | Task |
|---|---|---|
| H1 | **DONE** | ~~Apply TWO migrations in the Supabase SQL editor.~~ **Verified twice, independently:** `information_schema.columns` on 2026-08-01, and a direct PostgREST probe on 2026-08-03 — `bookings.approval_deadline_at` → 200, `users.terms_accepted_at` → 200. Every other filed migration was probed at the same time (`content_reports`, `user_blocks`, `messages.hidden_at`, `payments.post_id`) — all live. Probed, never read from a migration header; those have lied three times. |
| H2 | **DONE** | ~~Merge PR #81.~~ Merged 2026-07-31, along with #82–#85. Render reports `environment: production` and `/health` is green. |
| H3 | **DONE** | ~~Check `STRIPE_SECRET_KEY` in Render.~~ **Kira verified 2026-08-03: it is a test key.** Note for anyone re-checking: `/health` reporting `stripe: ok` proves the key *parses*, not which mode it is in — the only proof is reading the prefix. Payments stay in sandbox for the whole beta. |

| H18 | **TODO** | **Stripe → enable Connect** (Dashboard → Connect → Get started). Free, stays in test mode. **This is the only thing blocking D5 payouts.** Verified live 2026-08-03: `POST /v1/accounts type=express` returns *"You can only create new accounts if you've signed up for Connect."* Until it is on, no Connect call in PR #97 has ever round-tripped — the code is written and tested, but unproven against the real API. **Not** blocked on incorporation: Stripe test mode accepts synthetic identity and will flip an Express account to `payouts_enabled` without a real company. |
| H19 | **TODO** | **Cloudflare → add the email routing rule for `amr@swingbyy.com`.** It is the login for the X / Instagram / TikTok accounts and currently routes **nowhere** — a password reset would vanish and the account would be unrecoverable. The domain's MX and SPF are already live (verified by dig), so this is one rule, not a setup. |
| H20 | **TODO** | **Claim `swingbyy` on LinkedIn, Facebook and YouTube.** All three probed free on 2026-08-04/05 — `/company/swingbyy` 404, `/swingbyy` serves the generic Facebook title, `@swingbyy` 404 on YouTube. *(Corrected 2026-08-05: this row previously said LinkedIn was the last unclaimed handle. It isn't — Facebook and YouTube are open too, and **Facebook is the one that matters**: the Instagram Graph API needs a linked Page, so no Instagram automation can start without it.)* X, Instagram (`@swingbyy`) and TikTok (`@swingbyyy`, three y's) are done. |
| H22 | **TODO** | **Fix the display names on the two live accounts.** Read from the live profiles 2026-08-05: Instagram `@swingbyy` shows **"AMR"** with 0 posts; X `@swingbyy` shows **"Swing"**. Both should be **`SwingBy Calgary`** — the Calgary suffix also separates us from the three other companies trading as SwingBy. Five minutes, and right now neither live account says what the company is. |
| H23 | **TODO** | **Convert Instagram `@swingbyy` to a Business account.** Prerequisite for the Graph API — the DM bot, scheduling and every n8n social workflow are blocked on it, not on code. |
| H24 | **TODO** | **Cloudflare → DNS → `CNAME www → swingbyy.com`, proxied.** `www.swingbyy.com` returns nothing (apex returns 200) — re-verified 2026-08-05. Meta App Review needs a reachable privacy-policy URL, and anyone typing `www.` today gets a dead page. |
| H21 | **TODO** | **Apply the D5 migration** `supabase/migrations/20260803120000_*` in the Supabase SQL editor — connect columns + the `payouts` table. Additive and `if not exists` throughout. Only needed when PR #97 merges; filed, not applied. |

## Apple console — blocks TestFlight, not the dev build

> **DEFERRED 2026-08-03, re-scoped 2026-08-04.** The current loop runs on the
> installable **preview** build, not TestFlight, so none of this is this week's work.
>
> **⚠️ The order now matters, because Kira is incorporating in August** and wants a
> company to own SwingBy. **H7 creates the App Store Connect record under whichever
> Apple account exists at that moment**, and that account's name becomes the public
> *seller* on the store listing. Creating it personally and moving it to the company
> later is the expensive path: an App Store app transfer has conditions, and
> re-enrolling as an organization issues a **new Team ID**, invalidating
> `appleTeamId` in `mobile/eas.json` (two places) and the signing that H5 already
> proved works on device.
>
> **Order: incorporate → D-U-N-S number → enrol the Apple Developer Program as the
> organization → then H7–H10.** The D-U-N-S lookup is free through Apple but is not
> instant, so start it the day the company exists.
>
> ⚠️ **H4 is DONE against Team ID `ZTYJ33HPDX`, but whether that enrolment is
> Individual or Organization is recorded NOWHERE.** That single fact decides whether
> any of the above applies. Confirm it before planning around it.

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
| D2 | **PART-ANSWERED** | **Kira is incorporating in August**, and is considering a **holding company that owns SwingBy** so later projects sit under one entity. So the privacy-policy entity is *the company* — not `4alkubati` personally — and the registered address arrives with it. Both still open; the address becomes **public**, so a registered/virtual Calgary address likely beats the home one. The **deployed** policy is unaffected and already live. |
| D3 | **PARTLY ANSWERED** | **Apple Pay.** Google Pay is **built, on, and needs nothing from you** (`enableGooglePay: true`; Stripe's own merchant id covers it). Apple Pay is **code-complete and waiting on one account-side value**: the app reads the merchant id from the *server* response, so the wallet turns on with no app rebuild — but the iOS entitlement is gated on the build-time `STRIPE_MERCHANT_IDENTIFIER`. **Deferred with the rest of the Apple work (2026-08-04)** — the merchant ID should be registered by the *company*, not personally, for the same reason as H7. |
| D4 | **ANSWERED — ALREADY BUILT** | Kira, 2026-08-04: *"card on file needs to be there."* **It is.** Shipped in PR #83 and genuinely wired: SetupIntent endpoints, `services/cards.js`, and `PaymentMethodScreen` registered in **both** navigators and reachable from Profile, Business profile, QuoteComparison, BookingDetails and PostJob. Nothing to build — this one did not repeat the built-but-never-wired pattern. |
| D5 | **ANSWERED — INSTANT** | **A business must be able to take its money out instantly** (Kira, 2026-08-04). That means **Stripe Connect** (Express accounts) + **instant payouts** to a debit card, not manual transfers. Nothing pays out today; the ledger records `released_to_business` and stops there. The largest unbuilt piece of money work: onboarding/KYC, a payout endpoint, a Wallet screen. Still not an App Review blocker — nothing in the reviewed flow pays out. **Note:** Connect KYC is tied to the legal entity, so it wants the company from D2 to exist first, or it gets redone. |
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
| H14 | **TODO** | Confirm the handle to claim: **`swingbyy`** (free on IG/FB/X/YT). `@swingbyapp` is taken by three other companies. |
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
