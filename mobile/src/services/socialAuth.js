// socialAuth.js — client half of social sign-in.
//
// Google runs on every platform through the backend's PKCE redirect flow; the
// app never talks to Supabase directly (CLAUDE.md: service_role key is
// backend-only, and the whole OAuth dance is mediated by /auth/social/*).
//
// Apple is handled in a SEPARATE module (./appleAuth) that resolves to a
// no-op stub everywhere except iOS — so nothing here, and nothing Apple-shaped,
// ever enters the Android bundle. See appleAuth.js / appleAuth.ios.js.
//
// WHY THE TOKEN KEYS ARE DUPLICATED HERE
// --------------------------------------
// services/auth.js owns storeSession() but does not export it, and that file
// belongs to a different work lane. To avoid editing it, this module writes the
// SAME two SecureStore keys directly. They MUST stay in sync with auth.js:
//   TOKEN_KEY   = 'swingby_token'
//   REFRESH_KEY = 'swingby_refresh_token'
// If auth.js ever renames them, rename them here too.

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api, setAuthToken } from './api';
import * as SecureStore from './storage';
import { getMe } from './auth';

const TOKEN_KEY = 'swingby_token';
const REFRESH_KEY = 'swingby_refresh_token';

// Required on native so the browser tab that Supabase opens can hand control
// back to the app when the OAuth redirect fires. Harmless no-op on web.
WebBrowser.maybeCompleteAuthSession();

async function storeSession(accessToken, refreshToken) {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  }
}

// The redirect URI Supabase sends the auth code back to. `Linking.createURL`
// yields `swingby://auth-callback` in a dev-client / standalone build (the
// scheme is declared in app.json), which the backend allowlists. In Expo Go
// it becomes an exp:// URL — see docs/SOCIAL_SIGNIN_SETUP.md for the extra
// prefix the backend must allow for Expo Go testing.
export function getRedirectUri() {
  return Linking.createURL('auth-callback');
}

function extractCode(url) {
  if (!url) return null;
  const match = /[?&#]code=([^&#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Google sign-in. Opens the Supabase-hosted Google consent screen in a secure
 * browser tab, captures the returned auth code, exchanges it for a session,
 * persists the tokens, and resolves the user's profile.
 *
 * @param {{ role?: 'client'|'business_owner' }} opts
 *   `role` is only honoured for a brand-new account — an existing user keeps
 *   the role they already have (enforced server-side). Omit it when the button
 *   lives on the Login screen; pass it from the Signup screen's role picker.
 * @returns {Promise<{ profile: object, isNewUser: boolean, role: string }>}
 * @throws {Error} 'cancelled' if the user dismisses the browser; otherwise a
 *   message suitable for display.
 */
export async function signInWithGoogle({ role } = {}) {
  const redirectTo = getRedirectUri();

  // Step 1 — ask the backend for the authorize URL + PKCE verifier.
  const authorize = await api.post('/auth/social/authorize', {
    provider: 'google',
    redirect_to: redirectTo,
    role: role || undefined,
  });

  // Step 2 — run the OAuth dance in a browser tab and wait for the redirect.
  const result = await WebBrowser.openAuthSessionAsync(authorize.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    const err = new Error('cancelled');
    err.code = 'cancelled';
    throw err;
  }

  const code = extractCode(result.url);
  if (!code) {
    throw new Error('Google sign-in did not return an authorization code.');
  }

  // Step 3 — exchange code + verifier for a session (backend provisions the
  // users row: role + name + avatar, exactly like an email signup).
  const data = await api.post('/auth/social/exchange', {
    code,
    code_verifier: authorize.code_verifier,
    provider: 'google',
    role: role || undefined,
  });

  await storeSession(data.access_token, data.refresh_token);
  setAuthToken(data.access_token);
  const profile = await getMe();

  return { profile, isNewUser: !!data.is_new_user, role: data.role };
}

/**
 * Exchange a native OIDC id_token (from Apple, or a native Google SDK) for a
 * session. The Apple module calls this after expo-apple-authentication returns
 * an identityToken. Kept here so both social paths share one storage + /me tail.
 */
export async function signInWithIdToken({ provider, idToken, nonce, firstName, lastName, role }) {
  const data = await api.post('/auth/social/id-token', {
    provider,
    id_token: idToken,
    nonce: nonce || undefined,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    role: role || undefined,
  });

  await storeSession(data.access_token, data.refresh_token);
  setAuthToken(data.access_token);
  const profile = await getMe();

  return { profile, isNewUser: !!data.is_new_user, role: data.role };
}
