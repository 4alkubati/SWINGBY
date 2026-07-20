// Face ID / Touch ID / Android fingerprint unlock (CARD-24).
//
// Mirrors the lazy-require pattern in notifications.js: expo-local-authentication
// probes native modules at import time, which crashes Expo Go / web before any
// guard can run. We require() it lazily, only when actually about to use it.
//
// HARD RULE: every exported function here degrades to "unavailable" / no-op
// instead of throwing. A user who can't get in is a worse bug than no
// biometrics — callers must treat any falsy/failed result as "fall back to
// the normal password login," never a dead end.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from './storage';

const PREF_KEY = 'swingby_biometric_enabled';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

function loadModule() {
  if (isExpoGo || Platform.OS === 'web') return null;
  try {
    return require('expo-local-authentication');
  } catch {
    return null;
  }
}

/** Hardware present AND at least one biometric enrolled. False for anything else. */
export async function isBiometricAvailable() {
  const LocalAuthentication = loadModule();
  if (!LocalAuthentication) return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return !!isEnrolled;
  } catch {
    return false;
  }
}

/**
 * Which kind of biometric is enrolled, for copy purposes only
 * ('facial' | 'fingerprint' | 'iris' | null). Never throws.
 */
export async function biometricKind() {
  const LocalAuthentication = loadModule();
  if (!LocalAuthentication) return null;
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types?.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'facial';
    if (types?.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
    if (types?.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'iris';
    return null;
  } catch {
    return null;
  }
}

/**
 * Prompts the OS biometric sheet. Always resolves (never rejects) with
 * { success: boolean, error?: string }. `error` is not user-facing —
 * callers decide their own copy for the decline / unavailable paths.
 */
export async function authenticateAsync(promptMessage) {
  const LocalAuthentication = loadModule();
  if (!LocalAuthentication) return { success: false, error: 'unavailable' };
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      // Let the OS offer device passcode/PIN as its own fallback on top of
      // ours — belt and suspenders against a lockout.
      disableDeviceFallback: false,
      cancelLabel: undefined,
    });
    return { success: !!result.success, error: result.error };
  } catch (err) {
    return { success: false, error: err?.message || 'unknown' };
  }
}

/** Persisted opt-in flag — off (false) unless the user has explicitly enabled it. */
export async function getBiometricPref() {
  try {
    const val = await SecureStore.getItemAsync(PREF_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

export async function setBiometricPref(enabled) {
  try {
    if (enabled) {
      await SecureStore.setItemAsync(PREF_KEY, '1');
    } else {
      await SecureStore.deleteItemAsync(PREF_KEY);
    }
  } catch {
    // Non-fatal — worst case the toggle doesn't persist and defaults to off.
  }
}
