// iOS and Android should not be handed each other's platform features.
//
// MAPS — settled 2026-08-04, and this reverses the 2026-07-31 rule.
//
// The earlier ask ("if its ios then it gets apple maps with google maps") was
// read as "iOS gets Apple Maps", and iOS was given PROVIDER_DEFAULT. The
// founder clarified: "we can still use google maps in ios too". So it is
// GOOGLE ON BOTH, and what these tests pin is that neither platform silently
// falls back to PROVIDER_DEFAULT — on iOS that would quietly swap Google tiles
// for Apple ones and look like a styling bug rather than a provider change.
//
// The consequence to remember: the iOS build now NEEDS
// ios.config.googleMapsApiKey. An empty key renders a blank map, not a
// fallback. See the header of services/maps.js.
//
// The Apple sign-in half is unchanged and was ALREADY correct — Metro resolves
// ./appleAuth to appleAuth.js off iOS and that module is inert — but nothing
// pinned it, so a well-meaning "just import the real one" would have shipped an
// iOS-only native module into the Android bundle. Now it is pinned.

import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

import { pickProvider, darkMapProps } from '../services/maps';

// Stands in for react-native-maps' exported constants.
const MAPS = { PROVIDER_GOOGLE: 'google', PROVIDER_DEFAULT: 'default' };

describe('map provider is Google on every platform', () => {
  it('draws Google Maps on iOS', () => {
    // Not 'default' — PROVIDER_DEFAULT is Apple Maps on iOS, which is the
    // regression this pins against.
    expect(pickProvider('ios', MAPS)).toBe('google');
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

  it('uses the Google dark style on both platforms', () => {
    // customMapStyle is a Google prop, and Google now renders both platforms,
    // so the same dark style applies to each. `userInterfaceStyle` was the
    // Apple Maps workaround and would be a no-op on a Google-rendered map.
    expect(darkMapProps([{ a: 1 }], 'ios')).toEqual({
      customMapStyle: [{ a: 1 }],
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
