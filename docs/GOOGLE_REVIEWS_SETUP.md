# Google Review Import — Setup & Operator Guide

Walkthrough item **M3**: *"Import verified Google reviews at business signup:
connect Google account, pull curated verified reviews so nobody starts at
zero."* Built by LANE D, 2026-07-25.

> **The code is done and shipped DARK.** It is behind `GOOGLE_REVIEWS_ENABLED`,
> which defaults to **off**, because Google gates the Business Profile APIs
> behind a **manual approval SwingBy has not been granted yet**. Nothing below
> works until that approval lands. When it does, this is a one-env-var flip and
> a restart — no code change, no deploy of new logic.

---

## What it does

A business owner who already has years of real Google reviews should not land
on SwingBy with an empty profile. This connects the owner's **own** Google
Business Profile, pulls the reviews Google holds for a location they administer,
and shows them on their SwingBy profile **labelled as imported and verified** —
visibly distinct from reviews earned on SwingBy jobs.

### The trust rules it is built around

These are enforced in code, not just intended. If a future change breaks one,
the feature is doing harm rather than good:

1. **Nothing is fabricated, seeded, or scraped.** There is exactly one writer of
   the `business_imported_reviews` table, and it writes only what the Business
   Profile API returned for a location the connected Google account administers.
   Scraping Google would breach their ToS *and* make every imported review a lie
   about where it came from.
2. **No cherry-picking.** An import takes **every** review the chosen location
   has — the 1-stars come across with the 5-stars. There is deliberately no
   rating filter anywhere in the code path. "Curated" in the product ask means
   "genuinely from your own verified profile", not "the flattering ones".
3. **Never blended.** Imported reviews live in their own table and never touch
   `reviews`, `businesses.avg_rating` or `businesses.review_count`. The SwingBy
   rating keeps meaning *"rated on a job SwingBy escrowed and completed"*.
4. **Ownership is server-side.** No endpoint accepts a `business_id` to write
   to — the target is always resolved from the caller's JWT via
   `businesses.owner_id`. And the chosen location must appear in the connected
   Google account's own location list, so an owner cannot paste a competitor's
   resource name and inherit their reviews.

### Separate from Google sign-in

`backend/app/api/auth.py` already runs a Google OAuth flow. That is **sign-in**:
Supabase-mediated, identity scopes, produces a session. This is a **different
consent** — the `business.manage` scope, its own Google Cloud client, tokens we
hold ourselves, no session produced.

Signing in with Google grants nothing here. Connecting here does not affect
login. A user can revoke one without losing the other, and that separation is
deliberate — do not merge the two clients.

---

## What the founder must do in Google Cloud

### Step 0 — request Business Profile API access (THE LONG POLE)

This is the blocker, and it is the only step with a waiting period. Everything
else takes minutes.

1. Go to the **Google Business Profile APIs access request form**:
   https://developers.google.com/my-business/content/prereqs
   (the "Request access" / *Business Profile API access* form).
2. Submit it against the **same Google Cloud project** you will create the OAuth
   client in. You will need the project number, the project name, and a
   description of the use case.
   - Use case wording that matches what we actually built: *"Allow a verified
     business owner to import the reviews from their own Google Business Profile
     location into their SwingBy provider profile, displayed with attribution to
     Google. Read-only; no scraping; no third-party data."*
3. **Expect weeks, not days.** Google reviews these by hand and may come back
   with questions.
4. Once approved, in **APIs & Services → Library**, enable all four:
   - `My Business Account Management API`
   - `My Business Business Information API`
   - `Google My Business API` (the legacy v4 — **reviews still live only here**,
     they were never migrated to the split v1 APIs, so this one is not optional)
   - `My Business Notifications API` *(optional, not used today)*

### Step 1 — OAuth consent screen

1. **APIs & Services → OAuth consent screen** → **External**.
2. Add the scope `https://www.googleapis.com/auth/business.manage`.
3. This is a **sensitive scope**, so the app must be **published/verified** for
   users outside your own org. Until verification completes you can add
   individual business owners as **Test users** (cap: 100) and the flow works
   for them — which is enough for a beta.

### Step 2 — OAuth client

**APIs & Services → Credentials → Create Credentials → OAuth client ID.**

Two shapes work; the code supports both:

| Client type | Redirect URI | Secret |
|---|---|---|
| **Web application** (recommended) | `https://<your-api-host>/google-reviews/callback` | yes — set `GOOGLE_BUSINESS_CLIENT_SECRET` |
| **Android / iOS** (installed app) | `swingby://google-reviews-callback` | none — leave the secret unset; PKCE alone authenticates the exchange |

With the **Web** client, Google redirects to the backend, which forwards the
code to the app's deep link (`GET /google-reviews/callback` is that bridge).
With the **installed-app** client, Google redirects straight to the app.

PKCE (S256) is used either way.

---

## Env vars to set

Set these on **Render** (backend service → Environment). All are read at request
time via `os.getenv`, so a restart picks up a change — no redeploy needed.

| Var | Required | Value |
|---|---|---|
| `GOOGLE_REVIEWS_ENABLED` | to switch it on | `1` (also accepts `true`/`yes`/`on`). **Absent or anything else = OFF.** Leave unset until Google approves. |
| `GOOGLE_BUSINESS_CLIENT_ID` | yes, when on | OAuth 2.0 client id from Step 2, e.g. `1234-abc.apps.googleusercontent.com` |
| `GOOGLE_BUSINESS_CLIENT_SECRET` | Web client only | The client secret. **Omit entirely for an installed-app client** — it has none, and sending an empty one is rejected as `invalid_client`. |
| `GOOGLE_BUSINESS_REDIRECT_URI` | recommended | Default redirect when the app sends none, e.g. `swingby://google-reviews-callback` or `https://<api-host>/google-reviews/callback`. Must match Google exactly. |
| `GOOGLE_BUSINESS_REDIRECT_PREFIXES` | only for Expo Go | Extra comma-separated allowlist prefixes, on top of the built-in `swingby://` and `https://swingbyy.com/`. Needed to test in Expo Go, whose redirect is an `exp://…` URL — same situation as `SOCIAL_AUTH_REDIRECT_PREFIXES` in `docs/SOCIAL_SIGNIN_SETUP.md`. |

**No secret belongs in any committed file.** These are env vars only.

### Also required: run the migration

`supabase/migrations/20260725210000_google_business_reviews_import.sql` must be
applied before the flag is switched on. It is additive and safe to re-run.

Three tables:

- `business_google_connections` — the OAuth link + tokens. **No `authenticated`
  RLS policy at all**, deliberately: tokens are readable only by `service_role`,
  which never leaves the backend.
- `business_google_oauth_states` — one-shot PKCE/CSRF state, 15-minute expiry,
  `service_role` only. Rows past `expires_at` are safe to hard-delete.
- `business_imported_reviews` — the reviews. `SELECT` for any signed-in user
  (they are already public on Google); **writes are `service_role` only**, so a
  client holding a user JWT cannot manufacture a "verified" review even by
  hitting PostgREST directly.

---

## Switching it on, the day approval lands

1. Apply the migration (if not already applied).
2. Set `GOOGLE_BUSINESS_CLIENT_ID` (+ secret if Web client) and
   `GOOGLE_BUSINESS_REDIRECT_URI`.
3. Set `GOOGLE_REVIEWS_ENABLED=1`.
4. Restart the service.
5. Sign in as a business owner who really does own a Google Business Profile,
   go to **My Business → Reviews**, and press **Connect Google**.

Verify, in order: the consent screen lists *"Manage your Business Profile"* →
your locations appear → importing shows a count → the reviews render on the
public profile under **Verified Google reviews** with a `Google · Verified` pill
on each card → pressing import a second time reports **0 new**.

## Switching it back off

Set `GOOGLE_REVIEWS_ENABLED` to `0` (or remove it) and restart. Connect and
import immediately stop; already-imported reviews **keep showing**, which is
intentional — a flag flip must not silently blank data an owner legitimately
imported. To actually remove them, the owner presses **Disconnect**.

---

## What the owner sees while it is off

`GET /google-reviews/status` answers `{"enabled": false, "status":
"coming_soon", …}` — it deliberately answers rather than erroring, and that
response is the single thing the UI branches on.

- **Business signup** skips the Google step entirely. A screen whose only
  content is "coming soon" costs a tap and gives nothing.
- **My Business → Reviews** shows a calm card: *"Bringing your Google reviews
  across is coming soon — we're waiting on Google to approve SwingBy's access."*
  **No pressable control exists in that state**, so there is no button that can
  fail. This is covered by tests in
  `mobile/src/components/__tests__/GoogleReviews.test.js`.

Every gated endpoint answers **503** with an explanatory message, as a backstop
for a stale client build.

---

## API surface

Mounted at `/google-reviews` (`backend/app/api/google_reviews.py`).

| Method | Path | Who | Notes |
|---|---|---|---|
| `GET` | `/status` | owner | Answers with the flag off too — this is what the UI branches on |
| `POST` | `/connect` | owner | Returns the Google consent URL + opaque state |
| `GET` | `/callback` | Google | Unauthenticated bridge; forwards code+state to the app deep link |
| `POST` | `/callback` | owner | Exchanges the code, stores the connection |
| `GET` | `/locations` | owner | The connected account's locations |
| `POST` | `/import` | owner | Imports one location's reviews. **Idempotent** |
| `DELETE` | `/disconnect` | owner | Revokes at Google, deletes tokens **and** the imported reviews |
| `GET` | `/business/{id}` | any signed-in user | Client-facing read; every row carries `source` + `verified` |

**Idempotency** is the `UNIQUE (business_id, source, external_review_id)`
constraint plus an upsert on that conflict target. Re-importing refreshes rows
in place (a reviewer who edited their review gets updated) and never
duplicates — owners will press Import twice.

**Disconnect deletes the imported reviews on purpose.** Their entire claim is
"this business proved it owns the Google profile these came from". Once that
proof is withdrawn, continuing to display them would be showing an unbacked
claim. The app warns before firing.

---

## What could NOT be verified, because approval is pending

Everything below is written against Google's published API references and
covered by tests with mocked responses of the right shape
(`backend/tests/test_google_reviews.py`, 61 tests). **No call has ever been made
to a live Google endpoint.** These are the specific things to re-check on the
first real run:

1. **The whole OAuth round trip.** Consent screen wording, whether the
   `business.manage` grant returns a `refresh_token` on the first try, and
   whether the redirect URI matches byte-for-byte. Most likely first failure:
   `redirect_uri_mismatch`.
2. **v4 reviews endpoint shape.** Reviews are still on the legacy
   `mybusiness.googleapis.com/v4` API. The parser expects
   `{reviews: [{reviewId, reviewer: {displayName, profilePhotoUrl, isAnonymous},
   starRating, comment, createTime, updateTime}], averageRating,
   totalReviewCount, nextPageToken}`. If Google has since moved reviews to a v1
   surface, `GBP_REVIEWS_URL` and `_to_row()` are the two places to change.
3. **The location resource path.** The Business Information API returns bare
   `locations/{id}`; the v4 reviews endpoint wants
   `accounts/{a}/locations/{l}`. `_list_locations()` stitches them together.
   That stitching is the most plausible thing to be subtly wrong.
4. **Quotas.** The Business Profile APIs have a default per-project QPM that is
   low, and Google sets it per approved project. A launch-day import storm could
   hit it. The code caps one import at 200 reviews (`MAX_REVIEWS_PER_IMPORT`),
   50 per page, but does not implement backoff.
5. **`readMask` values.** `name,title,storefrontAddress` is required by the
   Business Information API; an unaccepted field name is a 400.
6. **Multi-account owners.** An owner who administers several Google accounts or
   location groups gets every location listed flat. Untested against a real
   multi-account profile.
7. **Whether Google's terms permit displaying imported reviews the way we do.**
   The API's attribution requirements should be re-read at approval time — we
   attribute to Google on every card, which is the intent, but the exact
   required wording/branding has not been checked against a current policy.

---

## Files

| Path | What |
|---|---|
| `backend/app/api/google_reviews.py` | The whole backend feature |
| `backend/tests/test_google_reviews.py` | 61 tests: auth boundary, idempotency, flag-off, star mapping |
| `supabase/migrations/20260725210000_google_business_reviews_import.sql` | The three tables + RLS |
| `mobile/src/services/googleReviews.js` | Client half of the OAuth + import flow |
| `mobile/src/components/GoogleReviewsConnect.js` | Owner control, incl. the coming-soon state |
| `mobile/src/components/ImportedReviewsSection.js` | Client-facing labelled review list |
| `mobile/src/screens/onboarding/BusinessSetupScreen.js` | The signup step |
| `mobile/src/screens/business/BusinessProfileScreen.js` | Owner control + public display |
