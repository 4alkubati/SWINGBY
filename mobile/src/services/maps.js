// maps.js — one decision about which map draws, made once.
//
// GOOGLE MAPS ON BOTH PLATFORMS (founder ruling, 2026-08-04: "we can still use
// google maps in ios too"). One map, one look, one set of tiles, so what he
// walks through on an iPhone is what a client sees on Android.
//
// This reverses the 2026-07-31 split, which read an earlier ask ("if its ios
// then it gets apple maps with google maps") as "iOS gets Apple Maps" and gave
// iOS PROVIDER_DEFAULT. That was a defensible reading — Apple Maps is native,
// keyless and free — but it is not what he wants to see on the device.
//
// THE COST, which is real and must not be rediscovered as a bug:
//
//   * The iOS build now carries the Google Maps SDK, and it REQUIRES
//     ios.config.googleMapsApiKey at build time (app.config.js injects it from
//     GOOGLE_MAPS_API_KEY). Apple Maps needed no key; Google does. **An iOS
//     build with an empty key renders a BLANK map, not a fallback.** That is
//     configuration, not a code fault — check the key before filing it.
//   * `customMapStyle` now applies on both platforms, because Google honours it
//     everywhere. `userInterfaceStyle` was only ever the Apple Maps workaround.
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

// Google on every platform. We name PROVIDER_GOOGLE explicitly rather than
// leaning on PROVIDER_DEFAULT, so the intent survives a react-native-maps
// upgrade that changes what "default" resolves to on either OS.
//
// `os` is still a parameter even though both branches now agree: it keeps the
// rule testable as arithmetic, and it is the seam if the platforms ever have to
// diverge again. The first version of this read Platform.OS directly and the
// test had to mock RN's Platform module inside jest.isolateModules — which
// passed alone and failed intermittently in a full run. A platform rule that
// can only be verified flakily is a platform rule nobody will trust.
export function pickProvider(os, m = mod) {
  if (!m) return null;
  return m.PROVIDER_GOOGLE ?? null;
}

// Spread onto <MapView>: the dark look. Google honours `customMapStyle` on both
// platforms, so there is one answer now. (`userInterfaceStyle` was the Apple
// Maps workaround and does nothing for a Google-rendered map.)
export function darkMapProps(googleStyle, os = Platform.OS) {
  return { customMapStyle: googleStyle };
}

export const MAP_PROVIDER = pickProvider(Platform.OS);
