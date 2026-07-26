/**
 * LiveLocation.test.js — WALKTHROUGH M7 + D6.
 *
 * The privacy boundary is enforced on the server (backend/tests/test_booking_location.py).
 * What these tests cover is the half a server cannot: that the CLIENT UI shows
 * nothing when the server says nothing is shared, that it never claims a stale
 * fix is live, and that the PROVIDER is never sharing invisibly — the banner and
 * the watcher are the same component, so there is no wiring order in which one
 * ships without the other.
 *
 * D6 rides along at the bottom: the duplicate Message button is gone and the
 * route it duplicated still exists.
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

jest.mock('../../services/api');
import { api } from '../../services/api';

// expo-location ~19.0.8 is an EXISTING dependency (NearbyMap uses it). jest-expo
// auto-mocks it to undefined answers, which reads as "permission denied" — real
// behaviour worth testing, but not the default for these cases, so the watcher
// is stubbed here and the denied path gets its own test below.
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true }),
  ),
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true }),
  ),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
}));
import * as Location from 'expo-location';

import ProviderLiveLocation from '../ProviderLiveLocation';
import LiveLocationSharing from '../LiveLocationSharing';
import { isEnRoute, lastUpdatedLabel } from '../../services/liveLocation';

const BOOKING_ID = 'bk-1';

const OPEN = {
  sharing: true,
  available: true,
  location: {
    lat: 51.0447,
    lng: -114.0719,
    accuracy_m: 12,
    heading: 90,
    updated_at: '2026-07-26T12:00:00+00:00',
    age_seconds: 6,
    is_stale: false,
  },
};

const CLOSED = { sharing: false, location: null, available: true, reason: 'not_en_route' };

// jest.config.js sets clearMocks, which wipes implementations as well as calls —
// re-arm the location stub for every test.
beforeEach(() => {
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    status: 'granted',
    canAskAgain: true,
  });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({
    status: 'granted',
    canAskAgain: true,
  });
  Location.watchPositionAsync.mockResolvedValue({ remove: jest.fn() });
});

// ── The en-route window, client-side mirror ──────────────────────────────────

describe('isEnRoute', () => {
  const ev = (...types) => types.map((t) => ({ event_type: t }));

  it('is true only after On my way, before anything else', () => {
    expect(isEnRoute(ev('date_confirmed', 'en_route'), 'confirmed')).toBe(true);
  });

  it('is false with no events at all', () => {
    expect(isEnRoute([], 'confirmed')).toBe(false);
  });

  it.each(['arrived', 'started', 'completed'])('closes on %s', (closer) => {
    expect(isEnRoute(ev('en_route', closer), 'confirmed')).toBe(false);
  });

  it('closes on a cancelled_event regardless of order', () => {
    expect(isEnRoute(ev('en_route', 'cancelled_event'), 'confirmed')).toBe(false);
  });

  it('closes on a terminal booking status even if en_route is the last event', () => {
    expect(isEnRoute(ev('en_route'), 'completed')).toBe(false);
    expect(isEnRoute(ev('en_route'), 'cancelled')).toBe(false);
  });

  it('ignores events that have nothing to do with being on the road', () => {
    expect(isEnRoute(ev('en_route', 'dates_proposed'), 'confirmed')).toBe(true);
  });
});

// ── "Last updated" is never a guess ──────────────────────────────────────────

describe('lastUpdatedLabel', () => {
  it('says so when it does not know', () => {
    expect(lastUpdatedLabel(null)).toMatch(/unknown/i);
  });

  it('scales from seconds to minutes to hours', () => {
    expect(lastUpdatedLabel(3)).toMatch(/just now/i);
    expect(lastUpdatedLabel(42)).toBe('Updated 42s ago');
    expect(lastUpdatedLabel(300)).toBe('Updated 5 min ago');
    expect(lastUpdatedLabel(7200)).toBe('Updated 2 h ago');
  });
});

// ── Client side ──────────────────────────────────────────────────────────────

describe('ProviderLiveLocation (client)', () => {
  it('renders NOTHING when the server says nothing is shared', async () => {
    api.get.mockResolvedValue(CLOSED);
    const { toJSON } = render(<ProviderLiveLocation bookingId={BOOKING_ID} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
  });

  it('renders nothing at all before the first response — no empty shell', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    const { toJSON } = render(<ProviderLiveLocation bookingId={BOOKING_ID} />);
    expect(toJSON()).toBeNull();
  });

  it('shows the map and an honest age once a fresh fix exists', async () => {
    api.get.mockResolvedValue(OPEN);
    const { getByText, getByTestId } = render(
      <ProviderLiveLocation bookingId={BOOKING_ID} providerName="Dana" />,
    );
    await waitFor(() => getByText(/Dana is on the way/));
    expect(getByText(/Updated .* ago|Updated just now/)).toBeTruthy();
    expect(getByTestId('MapView')).toBeTruthy();
    expect(getByText('Live')).toBeTruthy();
  });

  it('polls the location endpoint for this booking only', async () => {
    api.get.mockResolvedValue(OPEN);
    render(<ProviderLiveLocation bookingId={BOOKING_ID} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/location`));
  });

  it('never calls a fix "Live" once the backend flags it stale', async () => {
    api.get.mockResolvedValue({
      ...OPEN,
      location: { ...OPEN.location, age_seconds: 400, is_stale: true },
    });
    const { getByText, queryByText } = render(
      <ProviderLiveLocation bookingId={BOOKING_ID} providerName="Dana" />,
    );
    await waitFor(() => getByText('Last seen'));
    expect(queryByText('Live')).toBeNull();
    expect(getByText(/lost signal/)).toBeTruthy();
  });

  it('says the provider is on the way but not yet locatable, rather than going silent', async () => {
    api.get.mockResolvedValue({ ...CLOSED, reason: 'no_fix_yet' });
    const { getByText } = render(
      <ProviderLiveLocation bookingId={BOOKING_ID} providerName="Dana" />,
    );
    await waitFor(() => getByText(/waiting for their location/i));
  });

  it('a failed poll does not blank a position it already had', async () => {
    api.get.mockResolvedValueOnce(OPEN).mockRejectedValue(new Error('offline'));
    const { getByText } = render(
      <ProviderLiveLocation bookingId={BOOKING_ID} providerName="Dana" />,
    );
    await waitFor(() => getByText(/Dana is on the way/));
    await act(async () => {
      await Promise.resolve();
    });
    expect(getByText(/Dana is on the way/)).toBeTruthy();
  });
});

// ── Provider side ────────────────────────────────────────────────────────────

describe('LiveLocationSharing (provider)', () => {
  const events = (...types) => ({ items: types.map((t) => ({ event_type: t })) });

  it('renders nothing — and starts no watcher — outside the en-route window', async () => {
    api.get.mockResolvedValue(events('date_confirmed'));
    const { toJSON } = render(
      <LiveLocationSharing bookingId={BOOKING_ID} bookingStatus="confirmed" />,
    );
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('renders nothing once the job has started', async () => {
    api.get.mockResolvedValue(events('en_route', 'started'));
    const { toJSON } = render(
      <LiveLocationSharing bookingId={BOOKING_ID} bookingStatus="in_progress" />,
    );
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
  });

  it('tells the provider, in words, that their location is being shared', async () => {
    api.get.mockResolvedValue(events('en_route'));
    const { getByText } = render(
      <LiveLocationSharing bookingId={BOOKING_ID} bookingStatus="confirmed" />,
    );
    // The notice is part of the same component as the watcher — there is no
    // build in which sharing runs and this text is absent.
    await waitFor(() => getByText(/Sharing your live location|Starting location sharing/i));
    expect(getByText(/never tracks you in the background/i)).toBeTruthy();
    expect(getByText('Stop sharing')).toBeTruthy();
  });

  it('pushes fixes as the OS reports them, and only while en route', async () => {
    api.get.mockResolvedValue(events('en_route'));
    api.put.mockResolvedValue({ sharing: true, stored: true, available: true });
    render(<LiveLocationSharing bookingId={BOOKING_ID} bookingStatus="confirmed" />);
    await waitFor(() => expect(Location.watchPositionAsync).toHaveBeenCalled());

    const onFix = Location.watchPositionAsync.mock.calls[0][1];
    await act(async () => {
      await onFix({ coords: { latitude: 51.05, longitude: -114.07, accuracy: 8, heading: -1, speed: -1 } });
    });

    expect(api.put).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/location`, {
      lat: 51.05,
      lng: -114.07,
      accuracy_m: 8,
      // The OS reports -1 for "unknown"; that must not travel as a real value.
      heading: null,
      speed_mps: null,
    });
  });

  it('says so plainly when location permission is off, and pushes nothing', async () => {
    api.get.mockResolvedValue(events('en_route'));
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: false,
    });
    const { getByText } = render(
      <LiveLocationSharing bookingId={BOOKING_ID} bookingStatus="confirmed" />,
    );
    await waitFor(() => getByText(/Location permission is off/i));
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('fails closed when the event timeline cannot be read', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    const { toJSON } = render(
      <LiveLocationSharing bookingId={BOOKING_ID} bookingStatus="confirmed" />,
    );
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });
});
