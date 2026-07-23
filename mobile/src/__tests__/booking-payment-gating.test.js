// Double-charge regression suite.
//
// The bug: BookingDetailsScreen decided "already paid?" by testing
// `payment.status !== 'paid_full'`. A successful Stripe capture writes
// status = 'held' (the capture webhook in backend/app/api/payments_stripe.py),
// and nothing anywhere writes 'paid_full' — so the test could never be false.
// After a client paid successfully the booking still looked unpaid, the
// "Pay with card" button stayed on screen, and a second tap opened a SECOND
// Stripe checkout. Confirmed against the live database: the one production row
// with a real PaymentIntent behind it sits at status='held'.
//
// The same stale test also kept "Mark as paid (cash / e-transfer)" on screen
// after a card payment, offering to record the job as paid twice over.
//
// Also covers the other action-bar bug on this screen: "Cancel booking" was
// shown to business users, whose navigator has no CancellationFlow route, so
// the button silently did nothing.

import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthProvider } from '../context/AuthContext';
import { BookingProvider } from '../context/BookingContext';
import { UnreadProvider } from '../context/UnreadContext';

import BookingDetailsScreen, {
  isAwaitingPayment,
  hasBeenCharged,
} from '../screens/client/BookingDetailsScreen';

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

// The gate under test is `user?.role === 'client' && isAwaitingPayment(...)`.
// A real AuthProvider in a test has no session, so user would be null and the
// button would be absent for the WRONG reason — every assertion below would
// pass vacuously. Pin a signed-in user so the role half is controlled and only
// the half under test is actually being measured. Mutable so the cancel-button
// tests can switch to a business owner.
const CLIENT_USER = { id: 'u1', role: 'client', first_name: 'Test', last_name: 'Client' };
const OWNER_USER = {
  id: 'u2', role: 'business_owner', first_name: 'Biz', last_name: 'Owner',
  business_id: 'biz1',
};
let mockUser = CLIENT_USER;

jest.mock('../context/AuthContext', () => {
  const actual = jest.requireActual('../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser,
      token: 'test-token',
      isLoading: false,
      logout: jest.fn(),
      updateUser: jest.fn(),
    }),
  };
});

beforeEach(() => {
  mockUser = CLIENT_USER;
});

// ─── The predicates ──────────────────────────────────────────────────────────

describe('isAwaitingPayment — the gate on "Pay with card"', () => {
  it('is TRUE only while the booking genuinely still owes money', () => {
    expect(isAwaitingPayment({ status: 'pending_payment' })).toBe(true);
    expect(isAwaitingPayment({ status: 'pending' })).toBe(true); // legacy
    expect(isAwaitingPayment({ status: 'failed' })).toBe(true);  // retry is correct
  });

  it('is FALSE once Stripe has captured — status "held" (the actual bug)', () => {
    expect(isAwaitingPayment({ status: 'held' })).toBe(false);
  });

  it('is FALSE for every other state where money has moved', () => {
    for (const status of [
      'partial_released', 'fully_released', 'paid_off_platform', 'refunded',
      'paid_full', 'partial', // older rows / older backends
    ]) {
      expect(isAwaitingPayment({ status })).toBe(false);
    }
  });

  it('is case-insensitive about the column value', () => {
    expect(isAwaitingPayment({ status: 'HELD' })).toBe(false);
    expect(isAwaitingPayment({ status: 'Pending_Payment' })).toBe(true);
  });

  it('fails SAFE: an unknown status never offers to charge again', () => {
    // Polarity is the whole design. A future rename, or a state this build
    // predates, must not fall through to "show the pay button".
    expect(isAwaitingPayment({ status: 'some_future_status' })).toBe(false);
    expect(isAwaitingPayment({ status: '' })).toBe(false);
    expect(isAwaitingPayment({})).toBe(false);
  });

  it('fails SAFE when there is no payments row at all', () => {
    // The row is fetched with .catch(() => null). A failed fetch means we do
    // not KNOW whether money was taken — staying silent beats double-charging.
    expect(isAwaitingPayment(null)).toBe(false);
    expect(isAwaitingPayment(undefined)).toBe(false);
  });
});

describe('hasBeenCharged — money has actually moved', () => {
  it('recognises the current vocabulary', () => {
    for (const status of ['held', 'partial_released', 'fully_released', 'paid_off_platform']) {
      expect(hasBeenCharged({ status })).toBe(true);
    }
  });

  it('still recognises the older names an earlier backend wrote', () => {
    expect(hasBeenCharged({ status: 'paid_full' })).toBe(true);
    expect(hasBeenCharged({ status: 'partial' })).toBe(true);
  });

  it('is false before any capture', () => {
    expect(hasBeenCharged({ status: 'pending_payment' })).toBe(false);
    expect(hasBeenCharged({ status: 'failed' })).toBe(false);
    expect(hasBeenCharged(null)).toBe(false);
  });
});

// ─── The screen ──────────────────────────────────────────────────────────────

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
  status: 'confirmed',
  total_amount: 200,
  business_id: 'biz1',
  businesses: { business_name: 'Test Cleaning Co.' },
  users: { first_name: 'Test', last_name: 'Client' },
};

/** Route api.get by path so the screen's parallel fetches both resolve. */
function mockApi(paymentRow) {
  api.get.mockImplementation((path) => {
    if (path.startsWith('/bookings/')) return Promise.resolve(BOOKING);
    if (path.startsWith('/payments/')) return Promise.resolve(paymentRow);
    return Promise.resolve({});
  });
}

async function renderScreen() {
  const utils = render(
    <Providers>
      <BookingDetailsScreen route={mockRoute} navigation={mockNavigation} />
    </Providers>
  );
  // Let the two parallel fetches settle before asserting on the action bar.
  // Anchor on a heading that is unique on the page — the business name renders
  // twice (avatar row + provider row) and findByText throws on multiple hits.
  await utils.findByText('Job Details', {}, { timeout: 5000 });
  return utils;
}

async function renderWithPayment(paymentRow) {
  mockApi(paymentRow);
  return renderScreen();
}

describe('BookingDetailsScreen does not invite a second charge', () => {
  it('hides "Pay with card" once the payment is captured (status: held)', async () => {
    const { queryByText } = await renderWithPayment({ status: 'held', total_charged: 200 });
    expect(queryByText('Pay with card')).toBeNull();
  });

  it('hides "Pay with card" once escrow has been released', async () => {
    const { queryByText } = await renderWithPayment({
      status: 'fully_released',
      total_charged: 200,
    });
    expect(queryByText('Pay with card')).toBeNull();
  });

  it('still shows "Pay with card" while the booking is unpaid', async () => {
    const { queryByText } = await renderWithPayment({
      status: 'pending_payment',
      total_charged: 200,
    });
    expect(queryByText('Pay with card')).not.toBeNull();
  });

  it('does not offer cash mark-as-paid on a completed, card-captured booking', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/bookings/')) {
        return Promise.resolve({ ...BOOKING, status: 'completed' });
      }
      if (path.startsWith('/payments/')) {
        return Promise.resolve({ status: 'held', total_charged: 200 });
      }
      return Promise.resolve({});
    });
    const { queryByText } = await renderScreen();
    expect(queryByText('Mark as paid (cash / e-transfer)')).toBeNull();
    // ...and it is still offered when the job really is unpaid.
  });

  it('does offer cash mark-as-paid on a completed, unpaid booking', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/bookings/')) {
        return Promise.resolve({ ...BOOKING, status: 'completed' });
      }
      if (path.startsWith('/payments/')) {
        return Promise.resolve({ status: 'pending_payment', total_charged: 200 });
      }
      return Promise.resolve({});
    });
    const { queryByText } = await renderScreen();
    expect(queryByText('Mark as paid (cash / e-transfer)')).not.toBeNull();
  });
});

describe('BookingDetailsScreen does not show a cancel button that goes nowhere', () => {
  // CancellationFlow is registered in ClientNavigator only, and its copy is
  // written from the client's side. `canCancel` had no role gate, so a business
  // user on a confirmed booking saw "Cancel booking" and tapping it did nothing.
  it('shows "Cancel booking" to the client on a confirmed booking', async () => {
    mockUser = CLIENT_USER;
    const { queryByText } = await renderWithPayment({
      status: 'pending_payment',
      total_charged: 200,
    });
    expect(queryByText('Cancel booking')).not.toBeNull();
  });

  it('hides "Cancel booking" from a business user on the same booking', async () => {
    mockUser = OWNER_USER;
    const { queryByText } = await renderWithPayment({
      status: 'pending_payment',
      total_charged: 200,
    });
    expect(queryByText('Cancel booking')).toBeNull();
  });

  it('hides "Cancel booking" from an employee too', async () => {
    mockUser = { id: 'u3', role: 'employee', first_name: 'Emp', last_name: 'Loyee' };
    const { queryByText } = await renderWithPayment({
      status: 'pending_payment',
      total_charged: 200,
    });
    expect(queryByText('Cancel booking')).toBeNull();
  });

  it('still hides it from the client once the job is no longer cancellable', async () => {
    mockUser = CLIENT_USER;
    api.get.mockImplementation((path) => {
      if (path.startsWith('/bookings/')) {
        return Promise.resolve({ ...BOOKING, status: 'completed' });
      }
      if (path.startsWith('/payments/')) {
        return Promise.resolve({ status: 'fully_released', total_charged: 200 });
      }
      return Promise.resolve({});
    });
    const { queryByText } = await renderScreen();
    expect(queryByText('Cancel booking')).toBeNull();
  });
});
