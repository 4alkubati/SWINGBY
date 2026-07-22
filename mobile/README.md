---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
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

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
