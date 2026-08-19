# SwingBy Mobile

React Native + Expo SDK 54 mobile app for the SwingBy service marketplace. Dual-sided: clients book local services, businesses manage jobs and employees.

## Quick Start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Copy env and configure API URL
cp .env.example .env

# Start dev server (web preview)
npx expo start --web
```

## Running Locally

### Web Preview (primary dev path)

```bash
npx expo start --web
```

Opens in your default browser. All screens work on web except:

- **Haptics** — `expo-haptics` is native-only; calls are no-ops on web
- **Push notifications** — `expo-notifications` requires a native build
- **Maps** — `react-native-maps` is native-only; web shows a placeholder
- **Secure storage** — falls back to `localStorage` on web (via `src/services/storage.js`)

### iOS Simulator

```bash
npx expo start --ios
```

Requires Xcode + iOS Simulator installed.

### Android Emulator

```bash
npx expo start --android
```

Requires Android Studio + emulator configured.

### EAS Build (production)

Not yet configured. Requires a paid Apple Developer account for iOS distribution.

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Client | client.test@swingbyy.com | Client2026! |
| Business | business.test@swingbyy.com | Business2026! |

## Project Structure

```
mobile/
  App.js                  # Entry point, font loading, navigation setup
  src/
    components/           # Reusable UI (Button, Text, Card, BottomSheet, etc.)
    context/              # AuthContext (login/signup/logout state)
    navigation/           # AuthNavigator, ClientNavigator, BusinessNavigator
    screens/              # All screen components
    services/             # api.js, auth.js, storage.js, toast.js, haptics.js
    theme/                # tokens.js (colors, spacing, radius, motion)
```

## Design System

- **Colors**: All from `src/theme/tokens.js`. No hex codes in components.
- **Typography**: Space Grotesk (headings), Inter (body). Loaded via `useFonts` in App.js.
- **Spacing**: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 scale.
- **Animations**: react-native-reanimated v3 (~3.16). Babel plugin configured.

## Native Module Handling

Modules that probe native APIs at import time are lazy-loaded via `require()` inside functions:

- `@sentry/react-native` (in App.js)
- `expo-notifications` (in services/notifications.js)
- `expo-device` (in services/notifications.js)

`expo-secure-store` is never imported directly. Use `src/services/storage.js` which routes to SecureStore on native and localStorage on web.

## Dependency advisories and SDK drift (SB-0038)

`npm audit` reports 15 high and 1 critical here. **None of them ship in the
app.** Every one is Expo/Metro build tooling, pulled in transitively by `expo`
itself:

`@expo/cli`, `@expo/metro`, `@expo/metro-config`, `metro`, `metro-config`,
`metro-transform-worker`, `tar` (critical), `shell-quote`, `undici`, `postcss`,
`nanoid`, `js-yaml`, `image-size`, `brace-expansion`, `fast-uri`, `expo`.

They run on a developer's machine and in EAS build containers. They are not in
the JS bundle a user downloads, so the number is not a measure of what is
exposed to users — which is exactly why it has been ignored, and exactly why
ignoring it is fine right up until it is not.

**They cannot be fixed individually.** `npm audit fix` will not move them:
every one is a transitive dependency of `expo`, pinned by the SDK. The fix for
all sixteen is a single Expo SDK upgrade.

`mobile/` CI therefore has no `npm audit --audit-level=high` gate, unlike the
web apps — a gate that can only be satisfied by an SDK migration is a gate that
is permanently red, and this repo has already learned what that costs twice
(SB-0057, SB-0058). The `--no-audit` flag was removed from the install steps on
2026-08-19 so the summary is at least VISIBLE in the CI log rather than
suppressed.

### Current versions

| | Pinned | Note |
|---|---|---|
| `expo` | `~54.0.35` | SDK 54 |
| `react-native` | `0.81.5` | pinned by SDK 54 |

Dependabot is configured for `/mobile` but deliberately ignores `expo*`,
`react` and `react-native` — those move together and `npx expo install --fix`
owns them, not a per-package PR.

**Who owns the upgrade: nobody, today.** That is the actual finding. An SDK
upgrade needs a device pass (the jest suite takes ~2.4h on the dev box and does
not exercise native modules), so it is not something to do unattended or in the
same change as anything else. Until it has an owner and a scheduled window, the
sixteen advisories stay, and this section exists so the next person can tell in
one read whether they matter — rather than rediscovering the triage.
