// googleReviews.js — client half of "bring your Google reviews across" (M3).
//
// Backend: backend/app/api/google_reviews.py, mounted at /google-reviews.
//
// BUILT DARK. Google gates the Business Profile API behind a manual approval
// that has not landed yet, so the backend keeps the whole feature behind the
// GOOGLE_REVIEWS_ENABLED env flag. `getStatus()` is the ONLY thing the UI
// should branch on: when it answers `enabled: false` the UI must render a calm
// "coming soon" state and offer no button, because every other call will
// answer 503. Nothing here should ever surface a broken control.
//
// This is a SEPARATE consent from Google sign-in (services/socialAuth.js).
// Signing in with Google grants nothing here; connecting here creates no
// session. Different scope (business.manage), different Google client, and a
// user can revoke one without losing the other.

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api } from './api';

// Lets the browser tab hand control back to the app when the OAuth redirect
// fires. Idempotent, and a harmless no-op on web — socialAuth.js calls it too.
WebBrowser.maybeCompleteAuthSession();

/**
 * Where Google sends the browser back to. Yields `swingby://google-reviews-callback`
 * in a dev-client / standalone build (scheme declared in app.json), which the
 * backend allowlists by prefix. Deliberately a DIFFERENT path from sign-in's
 * `auth-callback` so a returning redirect can never be mistaken for the other
 * flow's.
 */
export function getGoogleReviewsRedirectUri() {
  return Linking.createURL('google-reviews-callback');
}

function extractParam(url, key) {
  if (!url) return null;
  const match = new RegExp(`[?&#]${key}=([^&#]+)`).exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Feature flag + connection state. Safe to call at any time — it answers even
 * when the feature is switched off, which is exactly how the UI knows to show
 * "coming soon" instead of a button.
 *
 * @returns {Promise<{enabled: boolean, connected: boolean, status: string,
 *   google_account_email?: string, selected_location?: string,
 *   selected_location_title?: string, last_import_at?: string,
 *   imported_count: number, imported_average_rating: number|null,
 *   message?: string}>}
 */
export function getStatus() {
  return api.get('/google-reviews/status');
}

/**
 * Run the Google Business Profile consent and register the connection.
 *
 * Three legs, same shape as socialAuth's sign-in flow: ask the backend for the
 * authorize URL, run the dance in a secure browser tab, hand the returned code
 * back for exchange. The PKCE verifier never travels with the code — the
 * backend holds it against the opaque `state`.
 *
 * @returns {Promise<{connected: boolean, google_account_email: string|null,
 *   locations: Array<{name: string, title: string, address: string}>}>}
 * @throws {Error} with `code === 'cancelled'` when the user dismisses the tab.
 */
export async function connectGoogleBusiness() {
  const redirectUri = getGoogleReviewsRedirectUri();

  const start = await api.post('/google-reviews/connect', {
    redirect_uri: redirectUri,
    app_redirect: redirectUri,
  });

  const result = await WebBrowser.openAuthSessionAsync(
    start.authorization_url,
    redirectUri,
  );
  if (result.type !== 'success' || !result.url) {
    const err = new Error('cancelled');
    err.code = 'cancelled';
    throw err;
  }

  const denied = extractParam(result.url, 'error');
  if (denied) {
    const err = new Error('cancelled');
    err.code = 'cancelled';
    throw err;
  }

  const code = extractParam(result.url, 'code');
  // Prefer the state Google echoed back, but fall back to the one we started
  // with so a redirect that drops it still completes rather than dead-ending.
  const state = extractParam(result.url, 'state') || start.state;
  if (!code) {
    throw new Error('Google did not return an authorization code.');
  }

  return api.post('/google-reviews/callback', { code, state });
}

/** The connected account's Business Profile locations, for the picker. */
export function listLocations() {
  return api.get('/google-reviews/locations');
}

/**
 * Import every review Google holds for `location`. Idempotent server-side — a
 * second import refreshes rows in place and reports `imported: 0`, so the
 * button is safe to press twice.
 *
 * @param {string} location Google resource name, "accounts/*\/locations/*".
 */
export function importReviews(location) {
  return api.post('/google-reviews/import', { location });
}

/**
 * Revoke at Google and remove the imported reviews. Deleting them is the
 * point, not a side effect: their whole claim is "this business proved it owns
 * the Google profile these came from", so the proof and the reviews go
 * together. Warn before calling.
 */
export function disconnect() {
  return api.delete('/google-reviews/disconnect');
}

/**
 * A business's imported reviews, for the public profile. Every row carries
 * `source` and `verified` — render both, never as a native SwingBy review.
 *
 * @returns {Promise<{reviews: Array<object>, summary: {count: number,
 *   average_rating: number|null}}>}
 */
export function getImportedReviews(businessId) {
  return api.get(`/google-reviews/business/${businessId}`);
}
