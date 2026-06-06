import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// expo-notifications and expo-device are NOT imported at the top level.
// Both packages probe native modules at module load. In Expo Go SDK 54+ those
// native modules don't exist, which crashes the JS runtime before any guards
// can fire. We require() them lazily, only when we are actually about to use
// them — which means never inside Expo Go.
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

/**
 * Configure foreground notification behavior.
 * Call this once at module level in App.js (outside any component).
 *
 * Safe to call from anywhere — no-ops in Expo Go and on web, and any thrown
 * native error is swallowed so app boot is never blocked.
 */
export function configureNotificationHandlers() {
  if (isExpoGo) return;
  if (Platform.OS === 'web') return;
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Swallow — push handler is a nice-to-have, never block app boot.
  }
}

/**
 * Request permission, obtain an Expo push token, and POST it to the backend.
 * Safe to call after login/signup — failure is non-fatal.
 */
export async function registerForPushAsync() {
  if (isExpoGo) return;
  if (Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    const Device = require('expo-device');

    if (!Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await api.post('/push-tokens/register', {
      token: tokenData.data,
      platform: Platform.OS,
    });
  } catch {
    // Permission denied, network failure, or missing native module —
    // none should block normal app usage.
  }
}
