// F126 — the price row's payment pill called paymentPillLabel(booking?.payment_status),
// but bookings.payment_status never carries 'paid_off_platform': payments_offplatform.py
// sets that value on the PAYMENTS row (payment.status) and writes 'fully_released' to
// bookings.payment_status for the off-platform case instead. The pill's
// case 'paid_off_platform': return 'PAID (OFF-PLATFORM)' could therefore never fire —
// an off-platform (cash/e-transfer) booking showed the generic 'PAID' pill.
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthProvider } from '../context/AuthContext';
import { BookingProvider } from '../context/BookingContext';
import { UnreadProvider } from '../context/UnreadContext';

import BookingDetailsScreen from '../screens/client/BookingDetailsScreen';

jest.mock('../services/api');
// eslint-disable-next-line import/first
import api from '../services/api';

const mockNavigation = {
  navigate: jest.fn(), goBack: jest.fn(), push: jest.fn(), pop: jest.fn(),
  replace: jest.fn(), setOptions: jest.fn(), setParams: jest.fn(),
  dispatch: jest.fn(), addListener: jest.fn(() => jest.fn()),
  canGoBack: () => true, getState: () => ({ routes: [], routeNames: [] }),
};
const mockRoute = { params: { bookingId: 'b1' }, key: 'k', name: 'BookingDetails' };

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
    useIsFocused: () => true,
    useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => cb(), []); },
  };
});

const CLIENT_USER = { id: 'u1', role: 'client', first_name: 'Test', last_name: 'Client' };

jest.mock('../context/AuthContext', () => {
  const actual = jest.requireActual('../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: CLIENT_USER, token: 'test-token', isLoading: false,
      logout: jest.fn(), updateUser: jest.fn(),
    }),
  };
});

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Providers({ children }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <AuthProvider>
          <BookingProvider>
            <UnreadProvider>{children}</UnreadProvider>
          </BookingProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const BOOKING = {
  id: 'b1',
  status: 'completed',
  // The bug: bookings.payment_status is 'fully_released' even for an
  // off-platform (cash) booking — payments_offplatform.py never writes
  // 'paid_off_platform' here.
  payment_status: 'fully_released',
  total_amount: 200,
  business_id: 'biz1',
  businesses: { business_name: 'Test Cleaning Co.' },
  users: { first_name: 'Test', last_name: 'Client' },
};

async function renderScreen(paymentRow) {
  api.get.mockImplementation((path) => {
    if (path.startsWith('/bookings/')) return Promise.resolve(BOOKING);
    if (path.startsWith('/payments/')) return Promise.resolve(paymentRow);
    return Promise.resolve({});
  });
  const utils = render(
    <Providers>
      <BookingDetailsScreen route={mockRoute} navigation={mockNavigation} />
    </Providers>
  );
  await utils.findByText('Job Details', {}, { timeout: 5000 });
  return utils;
}

describe('F126 — the price pill reads the payments-row status for off-platform', () => {
  it('shows "PAID (OFF-PLATFORM)" when the payments row says so, even though bookings.payment_status is fully_released', async () => {
    const { findByText } = await renderScreen({ status: 'paid_off_platform', total_charged: 200 });
    expect(await findByText('PAID (OFF-PLATFORM)')).toBeTruthy();
  });

  it('still shows the generic PAID pill for a real card capture', async () => {
    const { findByText, queryByText } = await renderScreen({ status: 'fully_released', total_charged: 200 });
    expect(await findByText('PAID')).toBeTruthy();
    expect(queryByText('PAID (OFF-PLATFORM)')).toBeNull();
  });
});
