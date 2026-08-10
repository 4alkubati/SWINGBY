// Walkthrough W8 — "the customer still isn't able to see the business arriving
// — the image on top still renders a normal image."
//
// Two things behind that, both pinned here.
//
// 1. THE KEY IS PART OF "CAN A MAP DRAW HERE". services/maps.js already
//    degraded to the designed MapCanvas when react-native-maps was absent (a
//    Huawei with no Play Services), but never when the Google Maps API key was
//    missing — and since the 2026-08-04 ruling that Google renders BOTH
//    platforms, a keyless build draws a blank rectangle rather than falling
//    back. The module's own header called that "configuration, not a code
//    fault"; nothing could act on it because the module never read the key.
//
// 2. THE HERO WAS HARDCODED TO THE CANVAS. Covered by the source assertions at
//    the bottom — ActiveBookingScreen had zero references to services/maps, so
//    on iOS, where the map draws perfectly, the main "where are they" screen
//    showed a drawing.
import fs from 'fs';
import path from 'path';

import { readMapsKey, hasMapsKey, fitRegion } from '../services/maps';

const SRC = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// app.config.js injects the key into BOTH shapes, and they differ — Android
// nests it under googleMaps, iOS is flat. Getting that wrong fails expo doctor
// in the cloud build only, so it is worth pinning here where it is cheap.
const withKey = (key) => ({
  android: { config: { googleMaps: { apiKey: key } } },
  ios: { config: { googleMapsApiKey: key } },
});

describe('reading the Maps key out of the app config', () => {
  it('finds it in the Android shape', () => {
    expect(readMapsKey('android', withKey('AIza-real'))).toBe('AIza-real');
  });

  it('finds it in the iOS shape', () => {
    expect(readMapsKey('ios', withKey('AIza-real'))).toBe('AIza-real');
  });

  it('does not read one platform\'s shape for the other', () => {
    const androidOnly = { android: { config: { googleMaps: { apiKey: 'k' } } } };
    expect(readMapsKey('ios', androidOnly)).toBeUndefined();
  });

  it('treats whitespace as empty', () => {
    expect(readMapsKey('ios', withKey('   '))).toBe('');
  });
});

describe('whether a real map is allowed to draw', () => {
  it('yes with a key', () => {
    expect(hasMapsKey('ios', withKey('AIza-real'))).toBe(true);
    expect(hasMapsKey('android', withKey('AIza-real'))).toBe(true);
  });

  it('NO with an empty key — the blank-rectangle case', () => {
    // app.config.js writes `googleMapsApiKey: mapsKey` with mapsKey = '' when
    // GOOGLE_MAPS_API_KEY is unset, so this is exactly what a keyless build
    // embeds. It must reach the MapCanvas fallback, not Google's blank tile.
    expect(hasMapsKey('ios', withKey(''))).toBe(false);
    expect(hasMapsKey('android', withKey(''))).toBe(false);
  });

  it('FAILS OPEN when there is no config to read', () => {
    // undefined means "cannot tell" — a test renderer or a runtime with no
    // embedded config. Guessing "no key" there would disable maps for builds
    // that have one.
    expect(hasMapsKey('ios', undefined)).toBe(true);
    expect(hasMapsKey('ios', {})).toBe(true);
  });
});

describe('framing a two-point hero map', () => {
  const dest = { lat: 51.0447, lng: -114.0719 };
  const prov = { lat: 51.0525, lng: -114.0625 };

  it('centres between the two points', () => {
    const r = fitRegion(dest, prov);
    expect(r.latitude).toBeCloseTo((51.0447 + 51.0525) / 2, 6);
    expect(r.longitude).toBeCloseTo((-114.0719 + -114.0625) / 2, 6);
  });

  it('leaves room around the pins rather than framing them on the edge', () => {
    const r = fitRegion(dest, prov);
    expect(r.latitudeDelta).toBeGreaterThan(51.0525 - 51.0447);
  });

  it('never zooms in past a readable box', () => {
    // Two fixes metres apart must not open at street-tile zoom.
    const r = fitRegion(dest, { lat: 51.04471, lng: -114.07191 });
    expect(r.latitudeDelta).toBeGreaterThanOrEqual(0.014);
    expect(r.longitudeDelta).toBeGreaterThanOrEqual(0.014);
  });

  it('works with only one point', () => {
    const r = fitRegion(dest, null);
    expect(r.latitude).toBe(dest.lat);
    expect(r.latitudeDelta).toBe(0.014);
  });

  it('is null with nothing real to centre on', () => {
    // A map centred on a guess is worse than a drawing that claims nothing.
    expect(fitRegion(null, null)).toBeNull();
    expect(fitRegion({ lat: null, lng: null }, undefined)).toBeNull();
    expect(fitRegion({ lat: 'x', lng: 'y' }, null)).toBeNull();
  });
});

describe('the booking hero draws a real map when it can', () => {
  const src = read('screens/client/ActiveBookingScreen.js');

  it('asks services/maps instead of hardcoding the canvas', () => {
    expect(src).toMatch(/from '\.\.\/\.\.\/services\/maps'/);
    expect(src).toMatch(/provider=\{MAP_PROVIDER\}/);
  });

  it('still falls back to MapCanvas', () => {
    // The Huawei path, and now the keyless path too. Removing this is how the
    // screen goes from "a drawing" to "a crash".
    expect(src).toMatch(/MapCanvas/);
    expect(src).toMatch(/if \(MapView && region\)/);
  });

  it('uses the shared dark style, not a second copy of it', () => {
    expect(src).toMatch(/DARK_MAP_STYLE/);
    expect(src).not.toMatch(/featureType: 'landscape\.man_made'/);
  });

  it('and NearbyMapScreen now imports that style rather than owning it', () => {
    const nearby = read('screens/client/NearbyMapScreen.js');
    expect(nearby).toMatch(/DARK_MAP_STYLE,?\n?\s*\} from '\.\.\/\.\.\/services\/maps'/);
    expect(nearby).not.toMatch(/const DARK_MAP_STYLE = \[/);
  });
});
