// Plot real coordinates onto our own map surface, with no map tiles involved.
//
// WHY THIS EXISTS
// ---------------
// The walkthrough device is a Huawei: no Google Play Services, so
// `react-native-maps` cannot render at all (audit B5/S5 — "not our bug, ignore
// it"). Every map in the app therefore falls back to `MapCanvas`, the styled
// gradient surface. That fallback was drawing FAKE geography:
//
//   ActiveBookingScreen  — a dashed route through five hardcoded pixel points
//   ProviderLiveLocation — a single dot pinned at dead centre, whatever the fix said
//
// So on the one device the app is being demoed on, "live tracking" showed a
// provider who was not moving along a road that did not exist. The fix is not to
// get Google Maps working — it cannot work there. It is to make the canvas tell
// the truth: given the provider's real position and the real job address, their
// relative position and distance are honest information, and drawing them needs
// no tiles.
//
// Coordinates come back as PIXELS because MapPin/MapRoute take raw SVG user
// units. MapDot/MapAvatarPin want percentages — use `asPercent`.

const EARTH_RADIUS_KM = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;

function isCoord(p) {
  return (
    p != null &&
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng)
  );
}

/** Great-circle distance in km. Null unless both points are real coordinates. */
export function distanceKm(a, b) {
  if (!isCoord(a) || !isCoord(b)) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "800 m" under a km, "2.3 km" above. Null in, null out. */
export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.round(km * 1000 / 50) * 50} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Fit `points` into a `box` ({width, height}) in pixels.
 *
 * Returns `{ points: [{...input, x, y}], scaleKmPerPx }`, or null when there is
 * no usable box. Input points that are not real coordinates are dropped, so a
 * caller can pass a provider fix that has not arrived yet.
 *
 * Two things this gets right that a naive lat->y, lng->x mapping does not:
 *
 * 1. LONGITUDE COMPRESSION. A degree of longitude is only `cos(latitude)` as
 *    wide as a degree of latitude. At Calgary's 51°N that is 0.63, so ignoring
 *    it stretches everything east-west by about 1.6x and the bearing between two
 *    pins is visibly wrong.
 * 2. ASPECT RATIO. The geographic bounding box is letterboxed into the view
 *    rather than stretched to fill it, so "north-east of you" stays north-east
 *    instead of shearing with the shape of the container.
 */
export function projectToBox(points, box, { padding = 28 } = {}) {
  const width = box?.width;
  const height = box?.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const real = (points || []).filter(isCoord);
  if (real.length === 0) return null;

  // Never let padding eat the whole box on a small container.
  const pad = Math.min(padding, width / 2 - 1, height / 2 - 1);
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  const lats = real.map((p) => p.lat);
  const lngs = real.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  // Equirectangular: x scales with longitude, corrected for latitude.
  const lngScale = Math.max(0.01, Math.cos(toRad(midLat)));

  const xs = lngs.map((lng) => lng * lngScale);
  const ys = lats.map((lat) => -lat); // north is up, so latitude inverts

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // One point, or several that coincide, has no extent to scale against — it
  // belongs at the centre, which is also the honest answer.
  if (spanX === 0 && spanY === 0) {
    return {
      points: real.map((p) => ({ ...p, x: width / 2, y: height / 2 })),
      scaleKmPerPx: null,
    };
  }

  // Letterbox: one scale for both axes, chosen so neither overflows.
  const scale = Math.min(
    spanX === 0 ? Infinity : innerW / spanX,
    spanY === 0 ? Infinity : innerH / spanY
  );
  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = (width - drawnW) / 2;
  const offsetY = (height - drawnH) / 2;

  const projected = real.map((p, i) => ({
    ...p,
    x: offsetX + (xs[i] - minX) * scale,
    y: offsetY + (ys[i] - minY) * scale,
  }));

  // Handy for a scale caption; degrees of latitude are ~111 km everywhere.
  const kmPerDegLat = 111.32;
  const scaleKmPerPx = scale > 0 ? kmPerDegLat / scale : null;

  return { points: projected, scaleKmPerPx };
}

/** Pixel coords -> percentages, for the View-positioned pins (MapDot et al). */
export function asPercent(point, box) {
  if (!point || !box?.width || !box?.height) return null;
  return {
    ...point,
    x: (point.x / box.width) * 100,
    y: (point.y / box.height) * 100,
  };
}
