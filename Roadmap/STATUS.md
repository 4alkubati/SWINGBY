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

### Pending merge — PR #81
Apple Team ID `ZTYJ33HPDX`, installable iOS `preview` profile, the Services-ID
doc correction, **and the M1 escrow fix**. Needs
`20260731120000_approval_gated_escrow_release.sql` applied first.

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
| `expiry_sweep.sweep_once` | ✅ | ❌ no scheduler at all | Expired posts never refund. No cron service, no worker, no APScheduler. |
| `POST /me/ghost` / `/me/unghost` | ✅ | ❌ no UI | Ghost mode was a product ruling (2026-07-21). Unreachable. |
| `GET /me/credits` | ✅ | ❌ no UI | Credits are issued by the cancellation ladder and cannot be seen. |
| `GET /reviews/client/{id}` | ✅ | ❌ unused | Businesses cannot see a client's history. |

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
- **M5 — dashboard "THIS WEEK" counts unpaid bookings**, everything else counts
  money that moved. Same label, two meanings ($590 vs $75). **OPEN.**

### Screens
- **P1** — `JOB STATUS` stepper and `Live status` card are two controls for one
  action. **OPEN.**
- **P2** — cancel copy truncated mid-word: *"a penalt…"*. **OPEN.**
- **P3** — two timestamps, neither labelled as *the appointment*. **OPEN.**
- **P4** — `Jobs` and `My Business` share one briefcase icon. **OPEN.**
- **P5** — "Detailed chart coming soon" shipped to users. **OPEN.**

### Platform + consent — raised 2026-07-31
- **X1 — no terms/privacy consent at signup.** Zero matches for
  agree/consent/terms in `SignupScreen`. Needed for the store and for PIPEDA.
  **OPEN.**
- **X2 — Sign in with Apple has no setup step.** ✅ **FIXED 2026-07-31.**
  `RolePickerSheet` now opens for a genuinely new social account and calls the
  `/auth/social/role` endpoint that had sat there with no caller. A 403 (window
  closed) lets the person through as a client rather than trapping them.
- **X3 — maps do not split by platform.** `PROVIDER_GOOGLE` is forced, so iOS
  uses Google Maps and needs the key. iOS should be able to use Apple Maps
  (`PROVIDER_DEFAULT`). **OPEN.**
- **X4 — Android is offered Sign in with Apple.** It should not be; Apple only
  requires it where another social login exists on *their* platform, and the
  native module is iOS-only anyway. **OPEN.**

---

## 4. Weekend plan — build is SUNDAY

Two days. Priority order, highest first:

1. **X2 + §2 wiring** — role picker after social sign-in. Endpoint already
   exists; this is app-side only.
2. **X1** — consent checkbox at signup.
3. **M5** — relabel/reconcile the dashboard headline. Cheap, high perceived
   impact.
4. **P1–P5** — screen defects. Mostly copy and one icon.
5. **X3/X4** — platform split for maps and Apple sign-in.
6. **M2** — card-on-file. Biggest remaining piece; may not fit the weekend.

`expiry_sweep` should be given the same lazy/endpoint treatment M1 got, or
deleted. It must not stay in the tree pretending to work.

---

## 5. Also this weekend — social

1. One post, published across all platforms as a single action.
2. The automation that sends it — n8n, or a plain Python/JS script.

Handles are already registered and recorded: see
`marketing/` and the social-handle notes. `@swingbyapp` is taken by three other
companies; **`swingbyyc`** is the free handle across IG/FB/X/YT.

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
