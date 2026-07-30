# iOS — TestFlight and the App Store

Written 2026-07-30, the day the Apple Developer account was paid for and sent for
confirmation. Everything here is either already done in the repo, or a thing only
Kira can do. Nothing in it is guesswork about what Apple wants.

**Read the two blockers first.** They will reject a submission, and neither is a
code change.

---

## 1. Two things that WILL fail review right now

### The privacy policy URL does not resolve

App Store Connect requires a live privacy-policy URL, and the reviewer opens it.
`swingbyy.com` has not built from this repo since before 2026-06-05
(`docs/DEPLOY.md`), so whatever we put in that field 404s or serves the wrong page.

Fix: point the Pages project's production branch at `main` and redeploy. That one
setting also unblocks the marketing site, the OG card and `/confirmed`. It is the
single highest-leverage thing outstanding on the whole project.

### Sign in with Apple — code is done, entitlement is not

Apple **requires** Sign in with Apple in any app that offers another social login.
SwingBy offers Google, so this is a rejection risk, not polish.

The code is finished and wired: `mobile/src/services/appleAuth.ios.js` is the real
implementation, `appleAuth.js` is the inert non-iOS twin (Metro picks per platform
so nothing Apple-related enters the Android bundle), and both `LoginScreen` and
`SignupScreen` already render the button behind `isAppleAuthAvailable()`.

What is missing is account-side only: enable the **Sign In with Apple** capability
for `com.swingby.app` in the Apple Developer portal. The
`expo-apple-authentication` config plugin writes the entitlement at prebuild; it
fails provisioning until the capability exists. See `docs/SOCIAL_SIGNIN_SETUP.md`
for the Supabase side.

---

## 2. What the repo already has

Verified 2026-07-30, not assumed:

| Thing | Where |
|---|---|
| Bundle identifier `com.swingby.app` | `mobile/app.json` |
| All required `infoPlist` usage strings — location, photos, camera, Face ID | `mobile/app.json` |
| `ITSAppUsesNonExemptEncryption: false` | `mobile/app.json` — skips the export-compliance questionnaire on every upload |
| Microphone permission string | written by the `expo-audio` plugin (`app.config.js`), not hand-rolled |
| Apple Sign-In plugin + dependency | `app.config.js`, `expo-apple-authentication@~8.0.8` |
| Stripe native plugin with the props object | `app.config.js` — the bare-string form crashes prebuild |
| App icon + splash on brand jet | `mobile/assets/icon.png`, `splash.png` |
| `testflight` + `production` build profiles, iOS submit config | `mobile/eas.json` |

`eas.json`'s `submit` blocks carry `REPLACE_WITH_*` placeholders. Fill them once the
account confirms — or delete the block and let `eas submit` prompt interactively the
first time, which is fine for a one-person team.

`preview` now builds iOS as a **simulator** build. That is free and needs no device
provisioning, but it cannot be installed on a phone — use `testflight` for that.
The Android `preview` APK is unchanged.

---

## 3. The order that wastes the least time

**TestFlight before the App Store.** A review rejection costs days; TestFlight
internal testing costs nothing and needs no review at all.

1. **Account confirms.** Note the **Team ID** (Membership page) and the Apple ID
   email.
2. **Create the app in App Store Connect** — name, primary language, bundle ID
   `com.swingby.app`, SKU (anything stable, e.g. `swingby-ios-01`). Note the
   **ASC App ID** (the numeric one in the URL).
3. **Enable Sign In with Apple** for the bundle ID in the Developer portal.
4. `eas build --platform ios --profile testflight`
5. `eas submit --platform ios --profile testflight`
6. **Internal testing** — up to 100 testers, no review, available in minutes. This
   is where the first real iPhone walkthrough happens.
7. Only then consider external testing (10k testers, light review) and the public
   listing.

Builds expire after **90 days**.

---

## 4. What App Store Connect will ask for that we do not have yet

The metadata is the part that actually takes calendar time. None of it is code.

- **Screenshots** — 6.7" iPhone is mandatory. Take them from a real device or the
  simulator build. The dashboard, an active booking, and quote comparison are the
  three that show what SwingBy is.
- **Description, keywords, subtitle, promotional text.** `marketing/` has voice and
  positioning to draw from.
- **Support URL** and **marketing URL** — both need to resolve (see blocker 1).
- **Privacy nutrition labels.** SwingBy collects location, photos, contact info and
  handles payments, so answer these carefully — a wrong label is a compliance
  problem, not a typo. Cross-check against `privacy-and-security/`.
- **Demo account.** A reviewer who cannot get into a marketplace app rejects it.
  Give them `testclient@swingby.dev` / `SwingBy2024!` and the business account
  alongside, plus a note that the app has two distinct roles.
- **Age rating** questionnaire.
- **Export compliance** — already answered by `ITSAppUsesNonExemptEncryption`.

## 5. Deliberately not done

- **Apple Pay.** `merchantIdentifier` stays empty. It needs a merchant ID
  registered with Apple *and* Apple Pay enabled in Stripe; a non-empty value writes
  an entitlement that fails provisioning. Card payments do not need it.
- **APNs push.** Expo's push service covers the current needs. Revisit if
  notifications matter more than they currently do.
- **iPad.** `supportsTablet: false`. A phone-first marketplace has no iPad story
  worth reviewing yet.
