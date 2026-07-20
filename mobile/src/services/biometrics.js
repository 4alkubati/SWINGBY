// CARD-24 — biometric unlock (Face ID / Touch ID / Android fingerprint).
// Wraps expo-local-authentication. Every function here is defensive: on web,
// in Expo Go, or on hardware without enrolled biometrics, these resolve to
// "not available" / "not authenticated" rather than throwing — callers must
// treat that as "fall back to normal login," never a lockout.
import { Platform } from 'react-native';
import * as SecureStore from './storage';

const ENABLED_KEY = 'swingby_biometric_enabled';

// Lazy-require so the native module is only touched on iOS/Android, mirroring
// the pattern already used for expo-notifications/Sentry in this codebase
// (native modules can throw at import time inside Expo Go).
function getModule() {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-local-authentication');
  } catch {
    return null;
  }
}

/** True if the device has biometric hardware AND at least one biometric enrolled. */
export async function isBiometricHardwareReady() {
  const LocalAuthentication = getModule();
  if (!LocalAuthentication) return false;
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return !!hasHardware && !!isEnrolled;
  } catch {
    return false;
  }
}

/** Runs the native Face ID / Touch ID / fingerprint prompt. Never throws. */
export async function authenticateAsync(promptMessage) {
  const LocalAuthentication = getModule();
  if (!LocalAuthentication) {
    return { success: false, error: 'unavailable' };
  }
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false, // allow the OS passcode fallback too
      cancelLabel: undefined,
    });
    return result;
  } catch {
    return { success: false, error: 'exception' };
  }
}

export async function isBiometricEnabled() {
  try {
    const v = await SecureStore.getItemAsync(ENABLED_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled) {
  try {
    await SecureStore.setItemAsync(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // Non-fatal — worst case the toggle doesn't persist and defaults off
    // again next launch, which is the safe direction to fail in.
  }
}
