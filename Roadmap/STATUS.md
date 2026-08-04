# SwingBy — STATUS

**Last verified: 2026-07-31.** Supersedes `DOMINOES.md` (last touched 2026-07-22)
as the current picture. Everything here was checked against live code, the live
database, or production HTTP — not inferred from other docs.

> **The rule this file exists to enforce:** a thing is DONE when it is on `main`,
> applied to production, **and reachable by a user**. Code that exists and is not
> wired is not done. See §2 — that failure mode has happened repeatedly.

---

## 1. What is actually live

| | State | Evidence |
|---|---|---|
| Backend | ✅ deployed | `/health` 200, database connected, Stripe ok |
| `ENV=production` on Render | ✅ fixed 2026-07-31 | `/health` reports `production` |
| All filed migrations | ✅ applied | probed every object via PostgREST |
| Report / block / content filter | ✅ live (PR #80) | `/moderation/reports` → 401, not 404 |
| Account deletion | ✅ fixed (PR #80) | was 422 on every attempt |
| No purchase link-out (3.1.1) | ✅ gated (PR #80) | build-time flag, regression-tested |
| First iOS build | ✅ built + installed | iOS 18 device, ad-hoc |
| **Sign in with Apple** | ✅ **works on device** | signs in end to end |

### Re-verified 2026-08-01 — everything above is still true, and more has landed
PRs #81–#85 are all **merged**; `main` is at `38c1166`. **Both migrations are
applied** — confirmed by querying `information_schema.columns` on the live
project, not by reading a file header (`bookings.approval_deadline_at`,
`users.terms_accepted_at`). Suites on `main`: **960 backend / 480 mobile green.**

**M2 (card-on-file) is DONE and wired** — PR #83. **Google Pay is on.** Apple
Pay is code-complete, gated only on a merchant id. See HUMAN-TODO D3/D4.

> ⚠ **The one thing that got worse, not better.** PR #84 was titled *"kill the
> 50/50 release claim everywhere, and make it unable to return."* It did
> neither. A sweep on 2026-08-01 found the claim alive in **20 files across three
> languages**, including five lines in `web/launch/src/locales/en.json` that the
> PR itself edited, and the `fr.json`/`ar.json` locales it never opened. The
> guard test passed the whole time because every one of its patterns matched the
> past participle *"released"* while the surviving copy said *"releases"*.
> Fixed, and the guard now covers the present tense and the two non-English
> locales — see §7.

---

## 2. ⚠️ Built but never wired

**This is the recurring failure and the reason this file exists.** Each of these
was written, reviewed, merged — and connected to nothing. `expiry_sweep` is the
canonical case: written weeks ago, called by nothing but its own tests.

Found by sweeping all 127 backend routes against every mobile source file.

| Thing | Built | Wired? | Consequence |
|---|---|---|---|
| `POST /auth/social/role` | ✅ | ✅ **WIRED 2026-07-31** | **A business signing in with Apple lands as a client with no way to say otherwise.** This endpoint exists precisely to fix that — one-shot, 24h window, client→business_owner only. |
| `isNewUser` from social sign-in | ✅ returned | ✅ **WIRED 2026-07-31** | The app cannot tell a brand-new account from a returning one, so no onboarding ever runs. |
| `expiry_sweep.sweep_once` | ✅ | ✅ **WIRED 2026-07-31** | Expired posts never refunded. Now settles on `GET /service-posts/my` (the client's own read), the business feed hides expired posts outright, and `POST /admin/sweeps/post-expiry` drives it in bulk. **There is still no scheduler** — that is why it settles on read. |
| `POST /me/ghost` / `/me/unghost` | ✅ | ✅ **WIRED 2026-07-31** | Ghost mode is promised in `PrivacyPolicyScreen` §3 and was reachable from nowhere. Now a Settings toggle; a 409 repeats the actual blocker. |
| `GET /me/credits` | ✅ | ✅ **WIRED 2026-07-31** | Credits are granted when a business cancels late and could not be seen. Shown in Settings when non-zero. **Still not spendable** — redemption is gated off (D6). |
| `GET /reviews/client/{id}` | ✅ | ❌ unused | Businesses cannot see a client's history. The last one, and the least harmful: an absent feature, not a broken promise. |

**Expected/benign** (listed so nobody re-flags them): `/admin/*` (web admin, not
deployed — refund + report queues moved in-app), `/payments/stripe/webhook`
(Stripe → server), `/waitlist/`, `/contact/` (web), `/auth/logout` (client-side),
`/admin/sweeps/approval-releases` (cron-only by design).

---

## 3. Open defects — first iOS walkthrough, 2026-07-31

Full detail: `~/brain/inbox/swingby-ios-walkthrough-2026-07-31.md`.

### Money
- **M1 — escrow released without the client.** ✅ **FIXED** in PR #81. Business
  "Complete" no longer moves money; client approves, or it auto-releases after
  24h. Settles lazily on read because there is no scheduler (see §2).
- **M2 — cannot save a card.** No SetupIntent, no payment-method endpoint.
  Stripe retains the card after the first payment (`setup_future_usage`), but
  there is no add / list / delete, and `users.default_payment_method_id` is
  never written. **OPEN.**
- **M3 — no Apple Pay, no Google Pay.** `merchantIdentifier` empty,
  `enableGooglePay: false`. Both deliberate; both need account-side work.
  **OPEN.**
- **M4 — accept falls back to a browser** when the native sheet is unavailable.
  Legal under 3.1.3(e); it is where the unpaid bookings came from. **OPEN.**
- **M5 — dashboard "THIS WEEK" counted unpaid bookings.** ✅ **FIXED
  2026-07-31.** It reads `released_to_business` off the payments now — the same
  source EarningsScreen uses — and carries a caption saying which number it is.
  Shows an em dash, never $0, when payments fail to load.

### Screens — all ✅ FIXED 2026-07-31
- **P1** — the stepper is a progress indicator now; the Live status button is
  the only control. That also retires the double-post class of bug.
- **P2** — the toast body was capped at two lines. Four now, shorter copy, and
  money outcomes stay up 6s.
- **P3** — the two timestamps are on separate lines and the logged-at one says
  "Logged".
- **P4** — `My Business` has its own glyph; a guard test fails on any duplicate.
- **P5** — replaced with a legend and a date range, which is what was missing.

### Platform + consent — raised 2026-07-31
- **X1 — no terms/privacy consent at signup.** ✅ **FIXED 2026-07-31.** A real
  checkbox on **step 0**, in front of Continue *and* both social buttons —
  step 0 is where Apple/Google sign-up lives, so a box next to "Create Account"
  on step 2 would have gated the slowest path and none of the fast ones.
  `TermsOfService`/`PrivacyPolicy` are registered in `AuthNavigator` too, so
  the links resolve while logged out (they previously threw). Consent is
  recorded in `users.terms_accepted_at` — best-effort, so a pending migration
  can never lock anyone out of signing up.
- **X2 — Sign in with Apple has no setup step.** ✅ **FIXED 2026-07-31.**
  `RolePickerSheet` now opens for a genuinely new social account and calls the
  `/auth/social/role` endpoint that had sat there with no caller. A 403 (window
  closed) lets the person through as a client rather than trapping them.
- **X3 — maps do not split by platform.** ✅ **FIXED 2026-07-31.** iOS draws
  Apple Maps (`PROVIDER_DEFAULT`), Android keeps Google. The choice lives in
  `services/maps.js` so the two map surfaces cannot drift. Trap closed with it:
  `customMapStyle` is Google-only, so iOS would have come back with a LIGHT map
  inside a dark app — `darkMapProps()` sends `userInterfaceStyle` instead.
- **X4 — Android is offered Sign in with Apple.** ✅ **Already correct**, and
  now pinned. Metro resolves `./appleAuth` to the inert `appleAuth.js` off iOS,
  so the button never renders and the iOS-only native module never enters the
  Android bundle. Nothing had tested it.

---

## 4. Weekend plan — build is SUNDAY

**Saturday is done.** X1, X2, X3, X4, M1, M5, P1–P5, `expiry_sweep`, ghost mode
and the credit balance all landed, with tests: **445 mobile / 919 backend
green.**

What is left, highest first:

1. **H1** — apply the two migrations. Blocks nothing in the app, but until then
   we cannot say when an account consented (see HUMAN-TODO).
2. **M2** — card-on-file (SetupIntent + a manage-cards screen). The biggest
   remaining piece and a **decision** first (D4): build it this cycle, or ship
   beta with a card retained only as a side effect of paying once.
3. **Social** — §5.
4. **M3/M4** — Apple Pay / Google Pay (needs D3 and a merchant id) and the
   browser-checkout fallback.
5. `GET /reviews/client/{id}` — the last unwired route. An absent feature, not
   a broken promise; wire it or delete it.

---

## 5. Social — ✅ built, blocked on accounts

1. **Two posts written and fact-checked:**
   `marketing/content-library/launch-post-2026-08.md`. Every claim was checked
   against the code, not against older copy — which mattered: five marketing
   files still promised *"payment in two stages — half at booking, half on
   completion"*, the exact claim that had to be pulled from the store listing
   on 2026-07-29. All five are corrected.
2. **One command publishes to all of them:** `tools/social_post.py`.
   Dry run by default, `--publish` to send, `--check` lists the credentials
   still missing. An unconfigured platform is skipped, not failed, so the first
   account that exists can post without waiting for the rest. 10 tests in CI.
3. **n8n was not chosen** — see H16. It is designed (43 nodes) and has never
   run; it needs Notion, OpenAI, Slack and Buffer before one post goes out.
   n8n can drive this script later from one node if the visible version is
   wanted.

**Blocked only on H15:** the accounts do not exist yet. `@swingbyapp` is taken
by three other companies; **`swingbyy`** is free across IG/FB/X/YT.

---

## 6. Known traps — do not re-learn these

- **`render.yaml` is decorative.** The Render service is not blueprint-managed,
  so editing that file changes nothing. Set env in the dashboard and verify via
  `/health`, which echoes `environment`.
- **Migration headers lie.** Three said "FILED, PENDING APPLY" while being live.
  Probe PostgREST; never trust `supabase_migrations` or a file header.
- **The App Store name "SwingBy" is taken** by five apps. Use
  `SwingBy: Book Local Services`. The bundle id `com.swingby.app` is clear.
- **Apple sign-in needs no Services ID** for this app — it is the native
  id-token flow, so Supabase only needs the bundle id in Client IDs.
- **`curl -I` proves nothing about swingbyy.com** — the SPA fallback answers 200
  for any path. Grep the deployed bundle.
- **Grep the RIGHT bundle.** `assets/index-*.js` is only the entry chunk; every
  page is code-split. `Personal Information Protection Act` returns **zero** hits
  there and is very much live — it sits in `assets/PrivacyPage-*.js`. Enumerate
  the chunk names out of the entry file first, or you will re-file the privacy
  policy as a blocker for the third time.

---

## 7. The live site is a stale build, and it is saying false things

Probed 2026-08-01 against production, not inferred.

`swingbyy.com` serves **`web/pre-launch`**, from a build made after 2026-06-05
and before PR #84. It has not rebuilt since, so it is serving copy this repo has
already corrected.

> Corrected later the same day: an earlier pass of this section said the live
> site was `web/launch`, on the strength of `About` / `BlogIndex` /
> `AccountSettings` / `Bookings` chunks in the bundle. **Those pages exist in
> both apps**, so they prove nothing. What settles it is the Terms prose and the
> `<title>`, which match `web/pre-launch` exactly.

Two consequences, both user-facing:

1. **The live Terms of Service states the cancellation ladder backwards.**
   Verbatim from `assets/TermsPage-*.js` today:
   > *"25% of the job amount if cancelled more than 48 hours before the
   > scheduled date, and 50% if cancelled within 48 hours."*

   The real ladder (`escrow.compute_cancellation_split`) is **free** more than
   48h out and **25%** within 48h. The live page charges a fee for the one rung
   that has none, **as terms of service**. `web/pre-launch/src/pages/TermsPage.jsx`
   in this repo is already correct — this is purely undeployed.

2. **The live marketing pages still promise the 50/50 staged release.**
   Same cause. Fixed in the repo now; still live until someone deploys.

**Neither is a code change — both just need the site to deploy.** That is now
wired: `.github/workflows/web-prelaunch-deploy.yml` builds and publishes
`web/pre-launch` on every push to `main` that touches it, then **asserts on the
live Terms prose** before going green. Dry-run against production today, that
assertion correctly fails — so it is checking something real.

**One human step remains:** add the repo secret `CLOUDFLARE_API_TOKEN`
(Cloudflare Pages:Edit), then run the workflow once. Until it exists the
workflow fails at preflight rather than pretending to ship.

Filed as H13 as "not a store blocker" — true for the *privacy* URL, but the
Terms page is a different document and it is currently wrong about money.

**The privacy policy itself is fine** — `assets/PrivacyPage-*.js` serves the
full PIPA policy with `privacy@swingbyy.com`. Safe for App Store Connect.
