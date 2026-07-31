// maps.js — one decision about which map draws, made once.
//
// Both map surfaces (NearbyMapScreen and ProviderLiveLocation) hard-coded
// `provider={PROVIDER_GOOGLE}`. On Android that is right — it is the only
// provider there. On iOS it forces the Google Maps SDK, which means the iOS
// build carries a second maps stack and a Google API key just to draw tiles
// that Apple Maps draws natively, for free, with no key, and faster.
//
// So: iOS gets PROVIDER_DEFAULT (Apple Maps), Android keeps Google.
//
// TWO CONSEQUENCES worth knowing before changing this back:
//
//   * `customMapStyle` is a Google-only prop. Apple Maps ignores it, so the
//     dark styling on iOS comes from `userInterfaceStyle="dark"` instead —
//     exported here as MAP_DARK_PROPS so neither screen has to remember.
//   * The lazy require is deliberate and predates this file: react-native-maps
//     is a native module, and a build without it (or an Android device with no
//     Play Services — the Huawei from the walkthrough) must degrade to the
//     designed MapCanvas rather than crash the screen. Everything below is
//     null on that path.

import { Platform } from 'react-native';

let mod = null;
try {
  mod = require('react-native-maps');
} catch {
  mod = null;
}

export const MapView = (mod && mod.default) || null;
export const Marker = (mod && mod.Marker) || null;

// PROVIDER_DEFAULT is Apple Maps on iOS and Google Maps on Android — but we
// name Google explicitly on Android so the intent survives a react-native-maps
// upgrade that changes what "default" means there.
//
// Takes `os` and the maps module as arguments so the rule can be tested as
// arithmetic. The first version of this read Platform.OS directly and the test
// had to mock RN's Platform module inside jest.isolateModules — which passed
// alone and failed intermittently in a full run. A platform rule that can only
// be verified flakily is a platform rule nobody will trust.
export function pickProvider(os, m = mod) {
  if (!m) return null;
  return os === 'ios' ? (m.PROVIDER_DEFAULT ?? null) : (m.PROVIDER_GOOGLE ?? null);
}

// Spread onto <MapView>: the dark look, expressed the way the active provider
// understands it.
export function darkMapProps(googleStyle, os = Platform.OS) {
  return os === 'ios'
    ? { userInterfaceStyle: 'dark' }
    : { customMapStyle: googleStyle };
}

export const MAP_PROVIDER = pickProvider(Platform.OS);
export const IS_APPLE_MAPS = Platform.OS === 'ios';
