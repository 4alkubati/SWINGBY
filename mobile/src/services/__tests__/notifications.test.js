// F117 / F118 — push notifications used to be write-only: registerForPushAsync
// existed but the Settings toggle never called it (F117), and nothing was
// listening for a tap at all (F118), so a tapped push just brought the app to
// whatever screen it already had open instead of the booking it was about.
// These pin the wiring, not the native SDK — expo-notifications, AsyncStorage
// and navigationRef are all mocked so this runs the actual listener callbacks
// this module registers.
jest.mock('expo-constants', () => ({
  appOwnership: null,
  executionEnvironment: null,
  expoConfig: { extra: { eas: { projectId: 'test-project' } } },
  easConfig: {},
}));

const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockGetExpoPushTokenAsync = jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' });
const mockGetLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);
let receivedCallback = null;
let responseCallback = null;
const mockAddNotificationReceivedListener = jest.fn((cb) => {
  receivedCallback = cb;
  return { remove: jest.fn() };
});
const mockAddNotificationResponseReceivedListener = jest.fn((cb) => {
  responseCallback = cb;
  return { remove: jest.fn() };
});

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...a) => mockGetPermissionsAsync(...a),
  requestPermissionsAsync: (...a) => mockRequestPermissionsAsync(...a),
  getExpoPushTokenAsync: (...a) => mockGetExpoPushTokenAsync(...a),
  getLastNotificationResponseAsync: (...a) => mockGetLastNotificationResponseAsync(...a),
  addNotificationReceivedListener: (...a) => mockAddNotificationReceivedListener(...a),
  addNotificationResponseReceivedListener: (...a) => mockAddNotificationResponseReceivedListener(...a),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../api', () => ({ api: { post: jest.fn().mockResolvedValue({}) } }));

const mockNavigateFromNotification = jest.fn();
jest.mock('../navigationRef', () => ({
  navigateFromNotification: (...a) => mockNavigateFromNotification(...a),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import {
  registerForPushAsync,
  registerNotificationResponseHandler,
} from '../notifications';

beforeEach(() => {
  jest.clearAllMocks();
  receivedCallback = null;
  responseCallback = null;
  mockGetLastNotificationResponseAsync.mockResolvedValue(null);
});

describe('registerForPushAsync', () => {
  it('registers the Expo push token with the backend', async () => {
    await registerForPushAsync();
    expect(api.post).toHaveBeenCalledWith('/push-tokens/register', {
      token: 'ExponentPushToken[test]',
      platform: expect.any(String),
    });
  });
});

describe('registerNotificationResponseHandler', () => {
  it('navigates to BookingDetails when a tapped notification carries a booking_id', async () => {
    registerNotificationResponseHandler();
    await Promise.resolve(); // let getLastNotificationResponseAsync settle
    expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalled();

    responseCallback({
      notification: {
        request: {
          content: {
            title: 'Booking update',
            body: 'Your provider is on the way',
            data: { booking_id: 'bk_123', event_type: 'on_the_way' },
          },
        },
      },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockNavigateFromNotification).toHaveBeenCalledWith('BookingDetails', {
      bookingId: 'bk_123',
    });
  });

  it('does not navigate when the payload carries no booking_id', async () => {
    registerNotificationResponseHandler();
    await Promise.resolve();

    responseCallback({
      notification: { request: { content: { title: 'New message', body: 'Hi', data: {} } } },
    });
    await Promise.resolve();

    expect(mockNavigateFromNotification).not.toHaveBeenCalled();
  });

  it('persists a received notification into the AsyncStorage key NotificationsCenterScreen reads', async () => {
    registerNotificationResponseHandler();
    await Promise.resolve();
    expect(mockAddNotificationReceivedListener).toHaveBeenCalled();

    receivedCallback({
      request: {
        content: {
          title: 'Booking confirmed',
          body: 'Your job has been confirmed.',
          data: { booking_id: 'bk_456' },
        },
      },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'swingby_notifications',
      expect.stringContaining('bk_456'),
    );
    const [, json] = AsyncStorage.setItem.mock.calls[0];
    const stored = JSON.parse(json);
    expect(stored[0]).toMatchObject({
      type: 'booking',
      title: 'Booking confirmed',
      read: false,
    });
  });

  it('replays a cold-start tap via getLastNotificationResponseAsync', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue({
      notification: {
        request: {
          content: { title: 'Booking update', body: '...', data: { booking_id: 'bk_cold' } },
        },
      },
    });

    registerNotificationResponseHandler();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockNavigateFromNotification).toHaveBeenCalledWith('BookingDetails', {
      bookingId: 'bk_cold',
    });
  });
});
