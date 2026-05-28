import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * Configure foreground notification behavior.
 * Call this once at module level in App.js (outside any component).
 */
export function configureNotificationHandlers() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Request permission, obtain an Expo push token, and POST it to the backend.
 * Safe to call after login/signup — failure is non-fatal.
 */
export async function registerForPushAsync() {
  // Push tokens are only available on physical devices.
  if (!Device.isDevice) return;

  // Skip on web — Expo push tokens are iOS/Android only.
  if (Platform.OS === 'web') return;

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
}
