// analytics-export.test.js — "make sure the business can export their
// analytics via whatever they need" (Kira, 2026-07-26).
//
// BusinessAnalyticsScreen gets a share icon in its header. Tapping it offers
// CSV or JSON; either choice calls GET /analytics/export?format=... and hands
// the response straight to React Native's core `Share` module — no
// expo-sharing / expo-file-system dependency was added (neither is in
// package.json, and the founder tests via Expo Go, so no new native module
// should ship for this). These tests pin: the format picker appears, each
// format hits the right endpoint and reaches Share.share with the right
// content, and a failed export toasts instead of crashing.

import React from 'react';
import { Alert, Share } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../../services/api');

// eslint-disable-next-line import/first
import { api } from '../../../services/api';
// eslint-disable-next-line import/first
import * as toast from '../../../services/toast';
// eslint-disable-next-line import/first
import BusinessAnalyticsScreen from '../BusinessAnalyticsScreen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  setParams: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  canGoBack: () => true,
};

function Providers({ children }) {
  return <SafeAreaProvider initialMetrics={METRICS}>{children}</SafeAreaProvider>;
}

const ANALYTICS_WITH_DATA = {
  avg_rating: 4.5,
  review_count: 3,
  total_bookings: 5,
  total_earnings: 450,
  profile_views: 12,
  conversion_rate: 40,
  repeat_rate: 20,
  top_categories: [{ category: 'Cleaning', count: 3 }],
  recent_reviews: [],
};

const CSV_BODY = 'booking_id,date,client_name,category,status,total_charged,refunded,platform_cut,released_to_business,escrow_held,verified\nbk-1,2026-06-01T00:00:00Z,Jordan,Cleaning,fully_released,150.00,50.00,10.00,90.00,0.00,true\n';

const JSON_BODY = JSON.stringify({
  range: { from: '2025-06-01T00:00:00+00:00', to: '2026-06-01T00:00:00+00:00' },
  items: [{ booking_id: 'bk-1', total_charged: 150, refunded: 50, released_to_business: 90 }],
  summary: { row_count: 1, total_revenue: 90 },
});

function mountScreen({ analytics = ANALYTICS_WITH_DATA } = {}) {
  api.get.mockImplementation((path) => {
    if (path === '/businesses/me/analytics') return Promise.resolve(analytics);
    return Promise.resolve({});
  });
  return render(
    <Providers>
      <BusinessAnalyticsScreen navigation={mockNavigation} route={{ params: {} }} />
    </Providers>
  );
}

describe('BusinessAnalyticsScreen — export control', () => {
  let alertSpy;
  let shareSpy;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert');
    shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    jest.spyOn(toast, 'show').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    shareSpy.mockRestore();
    toast.show.mockRestore();
  });

  it('shows an export control on the loaded analytics screen', async () => {
    const { getByLabelText } = mountScreen();
    await waitFor(() => expect(getByLabelText('Export analytics')).toBeTruthy());
  });

  it('tapping export offers a CSV / JSON choice', async () => {
    const { getByLabelText } = mountScreen();
    await waitFor(() => expect(getByLabelText('Export analytics')).toBeTruthy());

    fireEvent.press(getByLabelText('Export analytics'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Export Analytics');
    const labels = buttons.map((b) => b.text);
    expect(labels).toEqual(
      expect.arrayContaining([expect.stringContaining('CSV'), 'JSON', 'Cancel'])
    );
  });

  it('CSV choice calls the export endpoint with format=csv and shares the raw body', async () => {
    const { getByLabelText } = mountScreen();
    await waitFor(() => expect(getByLabelText('Export analytics')).toBeTruthy());

    // Re-wire the mock AFTER the initial analytics fetch has already
    // resolved — mountScreen()'s own mockImplementation only knows about
    // /businesses/me/analytics, so it must be extended, not replaced, before
    // the export endpoint is hit.
    api.get.mockImplementation((path) => {
      if (path === '/businesses/me/analytics') return Promise.resolve(ANALYTICS_WITH_DATA);
      if (path === '/analytics/export?format=csv') return Promise.resolve(CSV_BODY);
      return Promise.resolve({});
    });

    fireEvent.press(getByLabelText('Export analytics'));

    const csvButton = alertSpy.mock.calls[0][2].find((b) => b.text.includes('CSV'));
    await act(async () => {
      await csvButton.onPress();
    });

    expect(api.get).toHaveBeenCalledWith(
      '/analytics/export?format=csv',
      expect.objectContaining({ responseType: 'text' })
    );
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    const shareArg = shareSpy.mock.calls[0][0];
    expect(shareArg.message).toBe(CSV_BODY);
  });

  it('JSON choice calls the export endpoint with format=json and shares pretty-printed content', async () => {
    const { getByLabelText } = mountScreen();
    await waitFor(() => expect(getByLabelText('Export analytics')).toBeTruthy());

    api.get.mockImplementation((path) => {
      if (path === '/businesses/me/analytics') return Promise.resolve(ANALYTICS_WITH_DATA);
      if (path === '/analytics/export?format=json') return Promise.resolve(JSON_BODY);
      return Promise.resolve({});
    });

    fireEvent.press(getByLabelText('Export analytics'));

    const jsonButton = alertSpy.mock.calls[0][2].find((b) => b.text === 'JSON');
    await act(async () => {
      await jsonButton.onPress();
    });

    expect(api.get).toHaveBeenCalledWith(
      '/analytics/export?format=json',
      expect.objectContaining({ responseType: 'text' })
    );
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    const shareArg = shareSpy.mock.calls[0][0];
    // Pretty-printed (not the compact wire string) and round-trips to the
    // same data the server sent.
    expect(shareArg.message).not.toBe(JSON_BODY);
    expect(JSON.parse(shareArg.message)).toEqual(JSON.parse(JSON_BODY));
  });

  it('a failed export toasts an error instead of crashing, and never reaches Share', async () => {
    const { getByLabelText } = mountScreen();
    await waitFor(() => expect(getByLabelText('Export analytics')).toBeTruthy());

    api.get.mockImplementation((path) => {
      if (path === '/businesses/me/analytics') return Promise.resolve(ANALYTICS_WITH_DATA);
      if (path === '/analytics/export?format=csv') {
        return Promise.reject(new Error('network down'));
      }
      return Promise.resolve({});
    });

    fireEvent.press(getByLabelText('Export analytics'));

    const csvButton = alertSpy.mock.calls[0][2].find((b) => b.text.includes('CSV'));
    await act(async () => {
      await csvButton.onPress();
    });

    await waitFor(() =>
      expect(toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text1: 'Export failed' })
      )
    );
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it('the export control is also present on the empty-analytics state', async () => {
    const { getByLabelText } = mountScreen({
      analytics: {
        avg_rating: 0,
        review_count: 0,
        total_bookings: 0,
        recent_reviews: [],
        top_categories: [],
      },
    });
    await waitFor(() => expect(getByLabelText('Export analytics')).toBeTruthy());
  });
});
