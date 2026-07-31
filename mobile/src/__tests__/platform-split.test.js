// iOS and Android should not be handed each other's platform features.
//
// Two asks from the 2026-07-31 walkthrough:
//   "if its ios then it gets apple maps with google maps"
//   "for android they dont need sign in with apple id and they dont have apple
//    maps because they dont need it"
//
// The maps half was a real defect: both map surfaces hard-coded
// PROVIDER_GOOGLE, so the iOS build dragged in the Google Maps SDK and needed a
// Google API key to draw tiles Apple Maps draws natively for free.
//
// The Apple sign-in half was ALREADY correct — Metro resolves ./appleAuth to
// appleAuth.js off iOS and that module is inert — but nothing pinned it, so a
// well-meaning "just import the real one" would have shipped an iOS-only native
// module into the Android bundle. Now it is pinned.

import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

import { pickProvider, darkMapProps } from '../services/maps';

// Stands in for react-native-maps' exported constants.
const MAPS = { PROVIDER_GOOGLE: 'google', PROVIDER_DEFAULT: 'default' };

describe('map provider follows the platform', () => {
  it('draws Apple Maps on iOS', () => {
    expect(pickProvider('ios', MAPS)).toBe('default');
  });

  it('keeps Google Maps on Android', () => {
    expect(pickProvider('android', MAPS)).toBe('google');
  });

  it('stays null when react-native-maps is not in the build', () => {
    // The MapCanvas fallback path — a Huawei with no Play Services, or any
    // build without the native module.
    // null, not undefined: `undefined` would fall through to the default
    // parameter and pick up the real module.
    expect(pickProvider('ios', null)).toBeNull();
    expect(pickProvider('android', null)).toBeNull();
  });

  it('expresses the dark map the way each provider understands it', () => {
    // customMapStyle is a Google-only prop; on Apple Maps it is ignored, and
    // the map would have come back light inside a dark app.
    expect(darkMapProps([{ a: 1 }], 'ios')).toEqual({
      userInterfaceStyle: 'dark',
    });
    expect(darkMapProps([{ a: 1 }], 'android')).toEqual({
      customMapStyle: [{ a: 1 }],
    });
  });

  it.each([
    ['screens/client/NearbyMapScreen.js'],
    ['components/ProviderLiveLocation.js'],
  ])('%s no longer forces one provider', (file) => {
    const src = fs.readFileSync(path.join(SRC, file), 'utf8');
    expect(src).toMatch(/provider=\{MAP_PROVIDER\}/);
    expect(src).not.toMatch(/provider=\{PROVIDER_GOOGLE\}/);
  });
});

describe('Apple sign-in stays off Android', () => {
  it('the default (non-iOS) module reports unavailable', async () => {
    // The exact filename, not './appleAuth' — jest's default platform here is
    // ios, which would resolve the .ios.js twin and prove nothing.
    const appleAuth = require('../services/appleAuth.js');
    await expect(appleAuth.isAppleAuthAvailable()).resolves.toBe(false);
    expect(appleAuth.isAppleAuthSupportedPlatform()).toBe(false);
  });

  it('and throws rather than half-working if something calls it anyway', async () => {
    // The exact filename, not './appleAuth' — jest's default platform here is
    // ios, which would resolve the .ios.js twin and prove nothing.
    const appleAuth = require('../services/appleAuth.js');
    await expect(appleAuth.signInWithApple()).rejects.toThrow(/only available on iOS/);
  });

  it('both auth screens render the Apple button behind that check', () => {
    // If either screen ever renders it unconditionally, the Android build shows
    // a button that cannot work — and imports an iOS-only native module.
    for (const file of ['screens/auth/LoginScreen.js', 'screens/auth/SignupScreen.js']) {
      const src = fs.readFileSync(path.join(SRC, file), 'utf8');
      expect(src).toMatch(/appleReady && \(/);
      expect(src).toMatch(/isAppleAuthAvailable/);
    }
  });
});
