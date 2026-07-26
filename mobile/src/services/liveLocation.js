// liveLocation.js — WALKTHROUGH M7, provider side of the wire.
//
// The transport for "share my position with the client while I'm driving to
// their job". Kept as a plain module (no React) so the rules below are unit
// testable without mounting anything, and so the UI component in
// components/LiveLocationSharing.js is only ever the visible half.
//
// FOREGROUND ONLY — ON PURPOSE
// ----------------------------
// This uses `expo-location`'s watchPositionAsync, which is a FOREGROUND watcher:
// it runs while the business app is open and stops when the OS suspends it.
// Background location was deliberately NOT built. It would need a config-plugin
// change (app.config.js), a fresh native build, an Android foreground-service
// declaration, and an App Store / Play justification for a permission that lets
// an app follow a worker around when they are not using it. None of that is
// warranted by "the client can see the van approaching for the ten minutes
// before it arrives". expo-location ~19.0.8 is ALREADY a dependency (used by
// NearbyMap), so nothing here adds a native module and nothing here needs a
// rebuild.
//
// The honest consequence, which the UI states plainly: if the provider
// backgrounds the app, the dot goes stale and the client is told so.

import * as Location from 'expo-location';
import { api } from './api';

// One fix roughly every 10 s or 40 m of travel. Chosen against a car at city
// speed: 40 m is about 2 s of driving, so distanceInterval is effectively a
// floor for a stationary phone (no fixes while parked at a light) while
// timeInterval sets the real cadence. Tighter than this burns battery for a dot
// that moves a few pixels; looser and the marker visibly teleports.
export const PUSH_INTERVAL_MS = 10000;
export const PUSH_DISTANCE_M = 40;

// The client polls at this cadence. Slower than the push so a fix is normally
// already waiting; fast enough that "2 min ago" never appears on a live drive.
export const CLIENT_POLL_MS = 12000;

/**
 * Ask for FOREGROUND location permission.
 * Returns 'granted' | 'denied' — never throws, so a caller can render a state
 * instead of crashing the Status tab.
 */
export async function ensurePermission() {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing?.status === 'granted') return 'granted';
    // Do not re-prompt when the OS has already recorded a hard "no" — iOS
    // silently resolves denied and the user has to go to Settings.
    if (existing?.status === 'denied' && existing?.canAskAgain === false) {
      return 'denied';
    }
    const asked = await Location.requestForegroundPermissionsAsync();
    return asked?.status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Push one fix. Resolves to the server's answer, which is the AUTHORITY on
 * whether sharing is still allowed — the app never decides that for itself.
 *
 * Returns { sharing, stored, available } or null when the request failed
 * outright (offline). A null is treated as "keep trying": a dropped request on
 * a drive through a dead zone must not silently end the feed.
 */
export async function pushFix(bookingId, coords) {
  if (!bookingId || !coords) return null;
  try {
    return await api.put(`/bookings/${bookingId}/location`, {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy_m: coords.accuracy ?? null,
      // The OS reports -1 for "unknown" on both axes; send null rather than a
      // number the backend would have to special-case.
      heading: coords.heading != null && coords.heading >= 0 ? coords.heading : null,
      speed_mps: coords.speed != null && coords.speed >= 0 ? coords.speed : null,
    });
  } catch {
    return null;
  }
}

/** Tell the server to drop the stored position now. Best effort. */
export async function stopSharing(bookingId) {
  if (!bookingId) return false;
  try {
    await api.delete(`/bookings/${bookingId}/location`);
    return true;
  } catch {
    return false;
  }
}

// The four events the provider taps, in order (mirrors LiveStatusActions.FLOW).
const FLOW = ['en_route', 'arrived', 'started', 'completed'];

/**
 * Is this booking in the en-route window, according to its own event timeline?
 *
 * Pure — takes the `items` array from GET /bookings/{id}/events (oldest first,
 * as that endpoint returns it) and the booking status. This drives the BANNER
 * only. The server re-derives the same answer on every push and its verdict
 * wins; this exists so the provider is not shown a "sharing" banner for the
 * two seconds before the first PUT comes back.
 */
export function isEnRoute(events, bookingStatus) {
  if (['completed', 'cancelled'].includes((bookingStatus || '').toLowerCase())) {
    return false;
  }
  let last = null;
  for (const ev of events || []) {
    if (ev?.event_type === 'cancelled_event') return false;
    if (FLOW.includes(ev?.event_type)) last = ev.event_type;
  }
  return last === 'en_route';
}

/**
 * Start watching position and pushing fixes. Returns a stop() function.
 *
 * `onUpdate({ sharing, error })` fires after each push so the caller can render
 * the truth rather than an assumption. When the server says sharing is over
 * (arrived / started / completed / cancelled), the watcher tears itself down —
 * the app does not keep a GPS subscription alive for a feed nobody may read.
 */
export async function startSharing(bookingId, onUpdate = () => {}) {
  let subscription = null;
  let stopped = false;

  const teardown = () => {
    stopped = true;
    try {
      subscription?.remove?.();
    } catch {
      /* already gone */
    }
    subscription = null;
  };

  const permission = await ensurePermission();
  if (permission !== 'granted') {
    onUpdate({ sharing: false, error: 'permission' });
    return teardown;
  }

  try {
    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: PUSH_INTERVAL_MS,
        distanceInterval: PUSH_DISTANCE_M,
      },
      async (position) => {
        if (stopped) return;
        const res = await pushFix(bookingId, position?.coords);
        if (stopped) return;
        if (res && res.sharing === false) {
          teardown();
          onUpdate({ sharing: false, error: null });
          return;
        }
        onUpdate({
          sharing: true,
          error: res === null ? 'network' : null,
          available: res?.available !== false,
        });
      },
    );
  } catch {
    onUpdate({ sharing: false, error: 'unavailable' });
    return teardown;
  }

  return teardown;
}

/**
 * Read the provider's latest position for a booking (client side).
 * Never throws: a failure is indistinguishable from "nothing to show" as far as
 * the map is concerned, and an error toast on a background poll is noise.
 */
export async function fetchProviderLocation(bookingId) {
  if (!bookingId) return null;
  try {
    return await api.get(`/bookings/${bookingId}/location`);
  } catch {
    return null;
  }
}

/** "just now" / "40s ago" / "4 min ago" — the honest last-updated string. */
export function lastUpdatedLabel(ageSeconds) {
  if (ageSeconds == null) return 'Last update unknown';
  if (ageSeconds < 10) return 'Updated just now';
  if (ageSeconds < 60) return `Updated ${Math.round(ageSeconds)}s ago`;
  const mins = Math.floor(ageSeconds / 60);
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `Updated ${hours} h ago`;
}
