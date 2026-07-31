// M5 — "THIS WEEK" counted money that was never collected.
//
// On the 2026-07-31 walkthrough the dashboard headline read $590 while the card
// directly beneath it read "Held in escrow $160 / Cleared $75", and the
// Earnings screen read "This week $75.00". The headline was summing
// `total_amount` over confirmed and completed BOOKINGS — gross booked value,
// including bookings nobody ever paid for — while every other number in the app
// counts money that moved. Same word, two meanings, ~$193 of difference, no
// explanation anywhere on the screen.
//
// The number now comes from the same place EarningsScreen gets its number:
// `released_to_business` on the payments themselves.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';

jest.mock('../../../services/api');

jest.mock('../../../context/AuthContext', () => {
  const actual = jest.requireActual('../../../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'u-m5', role: 'business_owner', first_name: 'Biz' },
      token: 'test-token',
      isLoading: false,
      logout: jest.fn(),
      updateUser: jest.fn(),
    }),
  };
});

// eslint-disable-next-line import/first
import api from '../../../services/api';
// eslint-disable-next-line import/first
import DashboardScreen from '../DashboardScreen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockNavigation = {
  navigate: jest.fn(), goBack: jest.fn(), push: jest.fn(), replace: jest.fn(),
  setOptions: jest.fn(), setParams: jest.fn(),
  addListener: jest.fn(() => jest.fn()), canGoBack: () => true,
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

function mount({ bookings = [], payments = undefined } = {}) {
  api.get.mockImplementation((path) => {
    if (path === '/bookings/') return Promise.resolve({ items: bookings });
    if (path === '/payments/mine') {
      return payments === undefined
        ? Promise.reject(new Error('payments unavailable'))
        : Promise.resolve(payments);
    }
    return Promise.resolve({ items: [] });
  });
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>
        <DashboardScreen navigation={mockNavigation} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('Dashboard "THIS WEEK" is money that moved', () => {
  it('counts released payments, not the value of unpaid bookings', async () => {
    const { getByText, queryByText } = mount({
      // $500 of booked work that was never paid for. It must not appear.
      bookings: [
        {
          id: 'bk-1',
          status: 'confirmed',
          total_amount: 500,
          created_at: daysAgo(2),
        },
      ],
      payments: {
        items: [
          { id: 'p1', created_at: daysAgo(1), released_to_business: '75' },
          { id: 'p2', created_at: daysAgo(3), released_to_business: '25' },
        ],
        // Lifetime totals, deliberately different from the week's $100 so the
        // assertion below cannot accidentally match the "Cleared" figure.
        total_released: 260,
        total_pending: 160,
      },
    });

    await waitFor(() => expect(getByText('$100')).toBeTruthy());
    expect(queryByText('$600')).toBeNull();
    expect(queryByText('$500')).toBeNull();
  });

  it('ignores payments older than the week it claims to cover', async () => {
    const { getByText } = mount({
      payments: {
        items: [
          { id: 'p1', created_at: daysAgo(1), released_to_business: '40' },
          { id: 'old', created_at: daysAgo(9), released_to_business: '900' },
        ],
        total_released: 940,
        total_pending: 0,
      },
    });

    await waitFor(() => expect(getByText('$40')).toBeTruthy());
  });

  it('says nothing rather than $0 when payments did not load', async () => {
    // The money card below already follows this rule: not-loaded is not zero.
    // A business owner reading "$0" for a week they worked would reasonably
    // conclude the app lost their money.
    const { getByText } = mount({
      bookings: [
        { id: 'bk-2', status: 'completed', total_amount: 300, created_at: daysAgo(1) },
      ],
      payments: undefined,
    });

    await waitFor(() => expect(getByText('—')).toBeTruthy());
  });

  it('labels which number it is', async () => {
    const { getByText } = mount({
      payments: { items: [], total_released: 0, total_pending: 0 },
    });
    await waitFor(() => expect(getByText('cleared to you')).toBeTruthy());
  });
});
