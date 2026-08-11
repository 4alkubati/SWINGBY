import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { navigateFromNotification } from './navigationRef';

// Same key NotificationsCenterScreen.js reads (STORAGE_KEY there) — if either
// side renames it, rename both. Not imported directly to avoid pulling a
// screen into a service module.
const NOTIF_STORAGE_KEY = 'swingby_notifications';
const MAX_STORED_NOTIFS = 50;

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

// F058 — NotificationsCenterScreen has always rendered "No notifications
// yet": nothing in the app ever wrote to the AsyncStorage key it reads.
// persistNotification is that writer, fed by the two listeners below.
// event_type -> 'booking' is the only mapping backed by real backend data
// today (booking_events.py::_push_client_for_event is the sole call site
// that attaches a `data` payload at all — see F118 below); a push with no
// `data` still gets stored so the list is truthful, it just isn't
// deep-linkable (screenForType returns null for an unrecognised type, and
// NotifItem's default icon covers it).
async function persistNotification(content, { read }) {
  try {
    const data = content?.data || {};
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: data.event_type || data.booking_id ? 'booking' : undefined,
      title: content?.title || 'Notification',
      body: content?.body || '',
      createdAt: new Date().toISOString(),
      meta: { bookingId: data.booking_id },
      read,
    };
    const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(entry);
    if (list.length > MAX_STORED_NOTIFS) {
      list.splice(0, list.length - MAX_STORED_NOTIFS);
    }
    await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Best-effort — a lost notification-center entry must never break the
    // push itself.
  }
}

function handleNotificationReceived(notification) {
  persistNotification(notification?.request?.content, { read: false });
}

// F118 — every push this app sends carries `data.booking_id`
// (booking_events.py::_push_client_for_event is the one caller that attaches
// `data` at all today), but nothing was listening for a tap: no
// addNotificationResponseReceivedListener, no getLastNotificationResponseAsync.
// A tap just brought the app to whatever screen it already had open instead of
// the booking the notification was about.
//
// `BookingDetails` is registered under the same name and params shape in both
// ClientNavigator and BusinessNavigator, so routing there doesn't need to know
// the tapper's role.
function handleNotificationResponse(response) {
  const content = response?.notification?.request?.content;
  // Marked read: true — tapping it is already having seen it. A cold-start
  // tap never fires the "received" listener below, so this is also the only
  // record of that notification if it isn't persisted here too.
  persistNotification(content, { read: true });
  const bookingId = content?.data?.booking_id;
  if (!bookingId) return;
  navigateFromNotification('BookingDetails', { bookingId });
}

/**
 * Wire up push notification handling for the whole app session: persist every
 * notification into NotificationsCenterScreen's store, and tap-to-navigate.
 * Covers the warm case (app already running) and cold-start (app was killed
 * and the tap is what launched it). Call once at app root; returns an
 * unsubscribe function.
 */
export function registerNotificationResponseHandler() {
  if (isExpoGo) return () => {};
  if (Platform.OS === 'web') return () => {};
  try {
    const Notifications = require('expo-notifications');

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleNotificationResponse(response);
      })
      .catch(() => {});

    const receivedSub = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  } catch {
    return () => {};
  }
}

/**
 * Remove this device's Expo push token for the current user. Call from logout
 * BEFORE the auth token is cleared, otherwise the request is unauthenticated
 * and the row survives — the next user on this device would then receive the
 * previous user's notifications. Non-fatal: never blocks sign-out.
 */
export async function unregisterPushAsync() {
  if (isExpoGo) return;
  if (Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    const Device = require('expo-device');

    if (!Device.isDevice) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await api.post('/push-tokens/unregister', { token: tokenData.data });
  } catch {
    // Missing native module, network failure, or permission revoked — the
    // stale token will simply expire on Expo's side. Never block logout.
  }
}
