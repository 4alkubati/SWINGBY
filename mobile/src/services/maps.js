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
import Constants from 'expo-constants';

import { colors } from '../theme/tokens';

let mod = null;
try {
  mod = require('react-native-maps');
} catch {
  mod = null;
}

// ── The key is part of "can a map draw here", not a build detail ────────────
// The header above says an iOS build with an empty key renders a BLANK map,
// not a fallback, and calls that configuration rather than a code fault. It is
// both: nothing could ACT on it, because the one module that decides which map
// draws never looked at the key. So a keyless build drew a blank rectangle on
// every map surface — the nearby screen, the live-provider card, and (once it
// adopts this) the booking hero — while the designed MapCanvas fallback, which
// exists for exactly this, sat unused.
//
// Now the key is read the same way the native side receives it (app.config.js
// injects it into BOTH shapes: android.config.googleMaps.apiKey nested,
// ios.config.googleMapsApiKey flat) and a missing key degrades to the canvas.
//
// FAILS OPEN WHEN IT CANNOT TELL. `undefined` means "no config to read" — a
// test renderer, or a runtime that does not expose one — and guessing "no key"
// there would disable maps for builds that have one. Only an explicitly EMPTY
// string is treated as a missing key, and app.config.js always writes the
// field, so a real build always gives a definite answer.
export function readMapsKey(os, expoConfig) {
  if (!expoConfig) return undefined;
  const key =
    os === 'android'
      ? expoConfig.android?.config?.googleMaps?.apiKey
      : expoConfig.ios?.config?.googleMapsApiKey;
  return typeof key === 'string' ? key.trim() : undefined;
}

export function hasMapsKey(os, expoConfig) {
  const key = readMapsKey(os, expoConfig);
  return key === undefined ? true : key.length > 0;
}

export const MAPS_KEY_PRESENT = hasMapsKey(Platform.OS, Constants.expoConfig);

// Both conditions, in one place, so no screen has to remember either: the
// native module has to exist AND there has to be a key for it to draw with.
const canDrawRealMap = !!mod && MAPS_KEY_PRESENT;

export const MapView = (canDrawRealMap && mod.default) || null;
export const Marker = (canDrawRealMap && mod.Marker) || null;

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

export const MAP_PROVIDER = canDrawRealMap ? pickProvider(Platform.OS) : null;

// ─── Dark map style — mutes Google's default colors to match the app bg ─────
// Lived in NearbyMapScreen until the booking hero needed the same look. Two
// copies of a 14-rule style array is how one map surface quietly stops matching
// the other, so it sits with the rest of the map decisions instead.
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: colors.mapBgTop }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.textSecondary }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.bg }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: colors.border }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: colors.border }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: colors.surfaceAlt }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: colors.surface }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: colors.mapBgTop }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: colors.mapBgMid }],
  },
];

// The region a two-point map should open on: both ends visible with room to
// breathe, or a close-in box around whichever single point exists. Pure so the
// framing can be checked without a renderer — a map that opens too far out to
// read the street, or so far in that the provider is off-screen, is the same
// bug class as no map at all.
const SINGLE_POINT_DELTA = 0.014; // ~1.5 km — "which street", not "which city".

export function fitRegion(a, b, minDelta = SINGLE_POINT_DELTA) {
  const points = [a, b].filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (points.length === 0) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const latitude = (Math.min(...lats) + Math.max(...lats)) / 2;
  const longitude = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  // 1.6× the span so the pins sit inside the frame rather than on its edge.
  const latitudeDelta = Math.max((Math.max(...lats) - Math.min(...lats)) * 1.6, minDelta);
  const longitudeDelta = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.6, minDelta);

  return { latitude, longitude, latitudeDelta, longitudeDelta };
}
