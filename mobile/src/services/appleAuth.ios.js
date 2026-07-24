// appleAuth.ios.js — REAL Apple Sign In. iOS ONLY.
//
// Metro picks this file over appleAuth.js exclusively when bundling for iOS, so
// `expo-apple-authentication` and `expo-crypto` never touch the Android bundle.
//
// ⚠️ NOT YET LIVE — and cannot be until all of the following exist (none do as
//    of 2026-07-23; see docs/SOCIAL_SIGNIN_SETUP.md):
//      1. An Apple Developer Program membership ($99/yr) — NOT purchased.
//      2. A "Sign In with Apple" capability + Service ID configured in Apple.
//      3. The Apple provider enabled in Supabase Auth with that Service ID,
//         Team ID, Key ID and .p8 secret.
//      4. An actual iOS build (EAS) — the app has never been built for iOS.
//    Until then this code is correct-but-unreachable. It is guarded so that it
//    can only run on iOS, and the caller only ever renders the button when
//    isAppleAuthAvailable() resolves true (which requires a real device).
//
// NONCE FLOW (why two nonces): Supabase verifies that the identity token's
// `nonce` claim equals SHA256(raw_nonce). Apple embeds whatever nonce we hand
// signInAsync() into the token, so we hand Apple the SHA256 hash and hand the
// backend the RAW value; gotrue re-hashes the raw value and compares. Passing
// the same string to both, or skipping the hash, makes Supabase reject the
// token.

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { signInWithIdToken } from './socialAuth';

export function isAppleAuthSupportedPlatform() {
  return true;
}

// True only on a real iOS 13+ device signed into an Apple ID. On the iOS
// simulator and older iOS this is false, so the button stays hidden.
export async function isAppleAuthAvailable() {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function randomNonce(length = 32) {
  const bytes = Crypto.getRandomBytes(length);
  // URL-safe hex — content only needs to be unguessable, not compact.
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Runs the native Apple Sign In sheet and exchanges the identity token for a
 * SwingBy session. Apple only returns the user's name on the FIRST
 * authorization, so we forward whatever it gives us; the backend falls back to
 * the email local-part when it is absent.
 *
 * @param {{ role?: 'client'|'business_owner' }} opts
 * @returns {Promise<{ profile: object, isNewUser: boolean, role: string }>}
 * @throws {Error} 'cancelled' when the user dismisses the sheet.
 */
export async function signInWithApple({ role } = {}) {
  const rawNonce = randomNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if (e && e.code === 'ERR_REQUEST_CANCELED') {
      const err = new Error('cancelled');
      err.code = 'cancelled';
      throw err;
    }
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  return signInWithIdToken({
    provider: 'apple',
    idToken: credential.identityToken,
    nonce: rawNonce,
    firstName: credential.fullName?.givenName || undefined,
    lastName: credential.fullName?.familyName || undefined,
    role,
  });
}
