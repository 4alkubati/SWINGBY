# Social Sign-In — Setup & Operator Guide

Google (all platforms) + Apple (iOS only). Added by the AUTH lane, 2026-07-23.

This document is the hand-off checklist. The **code** is done and merged behind
a draft PR; **none of the console configuration below has been done**, so social
sign-in does not work in production until someone completes the FREE steps.
Apple additionally needs a PAID Apple Developer account.

---

## How it works (so the console steps make sense)

The mobile app never talks to Supabase directly. Every social flow is mediated
by the backend:

- **Google (PKCE redirect)** — `POST /auth/social/authorize` returns a
  Supabase `/auth/v1/authorize` URL + a PKCE `code_verifier`. The app opens the
  URL in a browser tab (`expo-web-browser`), Google authenticates the user,
  Supabase redirects back to `swingby://auth-callback?code=…`, and the app
  sends the code + verifier to `POST /auth/social/exchange`, which returns the
  same `{access_token, refresh_token, …}` envelope as `/auth/login`.
- **Apple / native id-token** — `expo-apple-authentication` returns a signed
  identity token; the app posts it to `POST /auth/social/id-token`, which hands
  it to Supabase for verification.

In **both** cases the backend then runs `_provision_social_user()` (in
`backend/app/api/auth.py`), which guarantees the new user has a `role` and a
fully-populated `users` row — name backfilled from the provider identity, avatar
from `picture`, role defaulted to `client` (or the role the app requested).
Without this, a social user would land as a nameless `users` row, because the
`handle_new_user()` trigger only sets `id/email` and blank names.

---

## FREE — required for Google to work at all

Google sign-in via Supabase Auth costs nothing. Do these:

### 1. Google Cloud Console — create OAuth credentials
1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → OAuth consent screen** → configure (External), add the
   app name, support email, and the `…/auth/v1/callback` domain below.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type **Web application**.
4. Under **Authorized redirect URIs** add Supabase's callback:
   `https://ulnxapnsenzyddddldjt.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client secret**.

### 2. Supabase Dashboard — enable Google
1. https://supabase.com/dashboard → project `ulnxapnsenzyddddldjt`
   → **Authentication → Providers → Google** → Enable.
2. Paste the Client ID + Client secret from step 1. Save.

### 3. Supabase Dashboard — allow the app redirect URLs
**Authentication → URL Configuration → Redirect URLs**, add:
- `swingby://auth-callback` — dev-client / standalone builds (the app scheme)
- `https://swingbyy.com/**` — web
- For **Expo Go** testing only, also add the tunnelled exp URL the app prints,
  e.g. `exp://10.0.0.168:8081/--/auth-callback`, AND set backend env
  `SOCIAL_AUTH_REDIRECT_PREFIXES=exp://` so the backend allowlist accepts it.
  Remove this before launch.

### 4. Backend env (optional, only for non-standard redirects)
`SOCIAL_AUTH_REDIRECT_PREFIXES` — comma-separated extra allowed redirect
prefixes. Defaults already cover `swingby://` and `https://swingbyy.com/`.

After steps 1–3, Google sign-in works on Android and web. No app rebuild is
needed for Google beyond shipping this branch (the two native modules
`expo-web-browser` + `expo-crypto` require a new dev-client/EAS build, since
they are native — Expo Go already bundles them).

---

## PAID — required before Apple sign-in can be turned on

Apple Sign In needs an **Apple Developer Program** membership: **US$99/year**,
**not purchased** as of 2026-07-23. There is also **no iOS build** yet. Until
both exist, the Apple button never renders (the app checks
`AppleAuthentication.isAvailableAsync()`, which is false without a real signed-in
iOS device) and the Apple code path is unreachable on Android by construction
(see "Android safety" below).

When the money + iOS build exist:

1. **Apple Developer** → enrol ($99/yr).
2. **Certificates, Identifiers & Profiles**:
   - App ID `com.swingby.app` → enable the **Sign In with Apple** capability.
   - Create a **Services ID** (e.g. `com.swingby.app.signin`) → enable Sign In
     with Apple → set Return URL to
     `https://ulnxapnsenzyddddldjt.supabase.co/auth/v1/callback`.
   - Create a **Sign In with Apple key** (.p8) → note the **Key ID** and your
     **Team ID**.
3. **Supabase → Authentication → Providers → Apple** → Enable → enter the
   Services ID (client id), Team ID, Key ID, and the .p8 secret contents.
4. Build iOS via EAS. The `expo-apple-authentication` config plugin (already
   registered in `mobile/app.config.js`) adds the
   `com.apple.developer.applesignin` entitlement during prebuild.

---

## Android safety (why Apple can't break the demo)

- `mobile/src/services/appleAuth.js` is the DEFAULT module; `appleAuth.ios.js`
  is picked by Metro **only** on iOS. The Android bundle resolves the stub, so
  `expo-apple-authentication` and all Apple code are physically absent from the
  Android build. Verified: jest (default platform `ios`) resolves the real
  module and it mounts; an Android bundle resolves the stub.
- The `expo-apple-authentication` config plugin has **iOS-only** mods and no
  Android native code, so it contributes nothing to an Android prebuild.
  `expo config` resolves cleanly with the plugin present and the Android
  `googleMaps` config is unchanged.

---

## Endpoints added (`backend/app/api/auth.py`)

| Endpoint | Purpose |
|---|---|
| `POST /auth/social/authorize` | Step 1 of Google PKCE — returns authorize URL + verifier |
| `POST /auth/social/exchange` | Step 2 — code + verifier → session + provisioned profile |
| `POST /auth/social/id-token` | Apple (and native Google) — id_token → session |
| `POST /auth/social/role` | One-shot role pick for a fresh social account (client→business only, ≤24h, escalation-guarded) |

All are rate-limited and reuse the same suspended/soft-deleted lifecycle guards
as `/auth/login`.
