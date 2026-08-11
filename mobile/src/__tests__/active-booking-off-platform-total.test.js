// F124 — ActiveBookingScreen's "Total" row branched only on
// `payment_state.capture_backed`, a boolean that's also true for
// `paid_off_platform` (escrow.was_ever_captured treats cash/e-transfer as
// "captured" too). A client who paid cash was told "held in escrow" for
// money that never touched SwingBy. The fix branches on
// `payment_state.state` first, so a genuinely off-platform payment reads
// "paid directly to the business" instead.
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../services/api');
// eslint-disable-next-line import/first
import { api } from '../services/api';

jest.mock('../services/liveLocation', () => ({
  fetchProviderLocation: jest.fn().mockResolvedValue(null),
  CLIENT_POLL_MS: 12000,
}));

// eslint-disable-next-line import/first
import ActiveBookingScreen from '../screens/client/ActiveBookingScreen';

const mockNavigation = {
  navigate: jest.fn(), goBack: jest.fn(), push: jest.fn(), pop: jest.fn(),
  replace: jest.fn(), setOptions: jest.fn(), setParams: jest.fn(),
  dispatch: jest.fn(), addListener: jest.fn(() => jest.fn()),
  canGoBack: () => true, getState: () => ({ routes: [], routeNames: [] }),
};

const wrap = (ui) => <SafeAreaProvider
  initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
>{ui}</SafeAreaProvider>;

const BASE_BOOKING = {
  id: 'b-1',
  status: 'confirmed',
  total_amount: 150,
  service_category: 'Cleaning',
};

function mountBooking(booking) {
  api.get.mockImplementation((url) => {
    if (String(url).includes('/events')) return Promise.resolve({ items: [] });
    return Promise.resolve(booking);
  });
  return render(wrap(
    <ActiveBookingScreen navigation={mockNavigation} route={{ params: { bookingId: 'b-1' } }} />
  ));
}

describe('F124 — off-platform payments never claim "held in escrow"', () => {
  it('reads "paid directly to the business" for a paid_off_platform booking, never "held in escrow"', async () => {
    const screen = mountBooking({
      ...BASE_BOOKING,
      payment_state: { state: 'paid_off_platform', capture_backed: true },
    });
    await waitFor(() => expect(screen.getByText(/Paid directly to the business/)).toBeTruthy());
    expect(screen.queryByText(/held in escrow/)).toBeNull();
  });

  it('still says "held in escrow" for a real escrow hold', async () => {
    const screen = mountBooking({
      ...BASE_BOOKING,
      payment_state: { state: 'held', capture_backed: true },
    });
    await waitFor(() => expect(screen.getByText(/held in escrow/)).toBeTruthy());
    expect(screen.queryByText(/Paid directly to the business/)).toBeNull();
  });

  it('still says "not paid yet" when nothing backs the total', async () => {
    const screen = mountBooking({
      ...BASE_BOOKING,
      payment_state: { state: 'unpaid', capture_backed: false },
    });
    await waitFor(() => expect(screen.getByText(/not paid yet/)).toBeTruthy());
  });
});
