// authLink.js — finish an auth round-trip that arrives from OUTSIDE the app.
//
// socialAuth.js already handles the in-app case: it opens a browser tab with
// `WebBrowser.openAuthSessionAsync`, which captures its own redirect and hands
// the URL straight back. That only works while the app is in the foreground
// holding the session open.
//
// An email confirmation is the other shape entirely. The client taps a link in
// Gmail hours later; the app is cold, or was killed. The URL arrives through
// `Linking`, not through a browser-session return value, and nothing in the app
// was listening for it — so a confirmed account still landed on the login
// screen and the client had to type their password anyway. That is M2.
//
// WHY THIS IS NOT A NAVIGATION ROUTE
// ----------------------------------
// `linkingConfig` maps URLs onto screens, but those screens only exist inside
// ClientNavigator / BusinessNavigator, and RootNavigator does not mount either
// until `user` is set. The common case is a confirmation link arriving while
// the user is logged OUT, so there is no navigator to route into yet. The
// link has to be consumed above navigation, which is what useAuthDeepLink
// does — completing the session makes RootNavigator swap to the real app on
// its own.
//
// NOT LOGGED OUT IS NOT GUARANTEED (F003). A device can carry a live session
// when a foreign/stale auth-callback link gets tapped anyway — a second test
// account's mail, an old link resurfacing, Gmail's link-preview crawler.
// `storeSession` below writes to the SAME SecureStore keys the live session
// uses, so an unguarded run here would silently overwrite or destroy it.
// Two independent defenses:
//   1. useAuthDeepLink skips calling this at all while a user is already
//      logged in (see its `alreadyLoggedIn` param) — the normal case.
//   2. Belt-and-braces, in case that guard is ever bypassed: this function
//      snapshots whatever session is already in SecureStore before writing
//      the new one, and restores it if the new token fails `getMe()` below,
//      instead of blind-deleting both keys.
//
// TOKEN KEYS: same two SecureStore keys as auth.js / socialAuth.js. See the
// note at the top of socialAuth.js — if auth.js renames them, rename here too.
import { setAuthToken } from './api';
import * as SecureStore from './storage';
import { getMe } from './auth';

const TOKEN_KEY = 'swingby_token';
const REFRESH_KEY = 'swingby_refresh_token';

// Supabase hands the session back on the URL FRAGMENT for the implicit flow
// (`#access_token=...&refresh_token=...`) and on the QUERY for PKCE
// (`?code=...`). Errors can arrive on either. Reading both is not defensive
// padding — the magic-link mail in production uses the fragment form, and the
// social flow uses the code form.
function readParams(url) {
  const out = {};
  if (!url) return out;
  const afterScheme = String(url).replace(/^[^?#]*/, '');
  for (const chunk of afterScheme.split(/[?#]/)) {
    if (!chunk) continue;
    for (const pair of chunk.split('&')) {
      const i = pair.indexOf('=');
      if (i === -1) continue;
      const k = decodeURIComponent(pair.slice(0, i));
      const v = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
      if (k && !(k in out)) out[k] = v;
    }
  }
  return out;
}

/**
 * Classify an incoming URL. Returns null when it is not an auth callback at
 * all, so the caller can ignore ordinary deep links (a booking, an invite)
 * without touching the session.
 *
 * @returns {null | {kind:'session', accessToken:string, refreshToken:string|null}
 *               | {kind:'code', code:string}
 *               | {kind:'error', message:string}}
 */
export function parseAuthCallback(url) {
  if (!url) return null;
  const p = readParams(url);

  // An error is an auth outcome even though it carries no tokens — an expired
  // link must say so, not fall through and look like an unrelated deep link.
  if (p.error || p.error_description || p.error_code) {
    return {
      kind: 'error',
      message:
        p.error_description ||
        p.error ||
        'That link could not be used. It may have expired.',
    };
  }

  if (p.access_token) {
    return {
      kind: 'session',
      accessToken: p.access_token,
      refreshToken: p.refresh_token || null,
    };
  }

  // A bare `?code=` is only ours when the link is an auth callback — booking
  // and invite deep links never carry one, but a referral code might, so the
  // path has to agree before we treat it as an auth code.
  if (p.code && /auth[-/]?(callback|confirm)/i.test(String(url))) {
    return { kind: 'code', code: p.code };
  }

  return null;
}

async function storeSession(accessToken, refreshToken) {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  }
}

/**
 * Complete a session from a confirmation / magic-link URL.
 *
 * Resolves `{ profile }` on success, or `null` when the URL was not an auth
 * callback. Throws with a displayable message when the link WAS ours but could
 * not be used (expired, already consumed) — the caller shows that to the client
 * rather than silently dropping them on the login screen wondering why.
 */
export async function completeAuthFromUrl(url) {
  const parsed = parseAuthCallback(url);
  if (!parsed) return null;

  if (parsed.kind === 'error') {
    const err = new Error(parsed.message);
    err.code = 'auth_link_invalid';
    throw err;
  }

  if (parsed.kind === 'code') {
    // PKCE links are only completable by the flow that minted the verifier,
    // and that verifier lives in the browser session socialAuth opened — it is
    // gone once the app has been killed. Say so plainly instead of firing an
    // exchange that is guaranteed to fail.
    const err = new Error(
      'Open this link on the device where you started signing in.'
    );
    err.code = 'auth_link_needs_verifier';
    throw err;
  }

  // Snapshot whatever session is already sitting in SecureStore BEFORE
  // overwriting it. Normally this is empty (see the header comment — the
  // hook keeps this function from even running while a session is live), but
  // if that guard is ever bypassed, this is what lets the catch below put the
  // prior session back instead of destroying it.
  const priorAccessToken = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  const priorRefreshToken = await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null);

  await storeSession(parsed.accessToken, parsed.refreshToken);
  setAuthToken(parsed.accessToken);

  try {
    const profile = await getMe();
    return { profile, accessToken: parsed.accessToken };
  } catch (e) {
    // The token did not survive first contact. Never leave the device worse
    // off than before the tap: restore whatever session was already there —
    // only clear a key when there genuinely was nothing to restore.
    if (priorAccessToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, priorAccessToken).catch(() => {});
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    }
    if (priorRefreshToken) {
      await SecureStore.setItemAsync(REFRESH_KEY, priorRefreshToken).catch(() => {});
    } else {
      await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
    }
    setAuthToken(priorAccessToken || null);
    const err = new Error('That sign-in link is no longer valid.');
    err.code = 'auth_link_rejected';
    throw err;
  }
}
