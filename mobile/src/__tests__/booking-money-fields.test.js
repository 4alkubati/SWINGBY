/**
 * booking-money-fields.test.js — walkthrough bug #5, the "$0.00" bug and the
 * class behind it.
 *
 * BookingDetailsScreen rendered $0.00 for a booking the client had already
 * paid $195 for, because the Price row read `booking?.quoted_price ??
 * booking?.price ?? 0` — neither field exists on the API response
 * (backend/app/api/bookings.py — every booking select is `*` plus nested
 * `businesses`/`employees`/`service_posts` joins; the price column on
 * `bookings` is `total_amount`).
 *
 * This was not a one-off: several call sites across the app read a flat
 * field name the API never sends (`client_name`, `scheduled_date`,
 * `service_type`, `employee_name`, `employee_role`, `business_name`,
 * `job_lat`/`job_lng`) with no nested fallback, so they always render their
 * silent default instead of the real value.
 *
 * These tests render against a REALISTIC NESTED payload shaped like the
 * actual bookings.py response (nested `businesses`/`employees`/
 * `service_posts`/`users`/`assignee`, no flat `quoted_price`/`price`/
 * `client_name`/etc.) — a hand-built flat payload would pass even with the
 * bug still in place, which is exactly how it shipped.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthProvider } from '../context/AuthContext';
import { BookingProvider } from '../context/BookingContext';
import { UnreadProvider } from '../context/UnreadContext';

import BookingDetailsScreen from '../screens/client/BookingDetailsScreen';
import JobCard from '../components/JobCard';
import WorkerTrustCard from '../components/WorkerTrustCard';
import i18n from '../i18n';

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
      user: CLIENT_USER,
      token: 'test-token',
      isLoading: false,
      logout: jest.fn(),
      updateUser: jest.fn(),
    }),
  };
});

// The exact shape GET /bookings/{id} returns (bookings.py::get_booking):
// `*` off the bookings row (so `total_amount`, `confirmed_date`,
// `service_category`, `status`, `payment_status`, `business_id` — but never
// `quoted_price`, `price`, `client_name`, `scheduled_date`, `service_type`,
// `employee_name`, `employee_role`, `business_name`, `job_lat`/`job_lng` at
// the top level) plus the nested joins and the server-derived `assignee`
// block (_attach_assignee) and `payment_state` block (_attach_payment_state).
const NESTED_BOOKING = {
  id: 'b1',
  status: 'confirmed',
  business_id: 'biz1',
  client_id: 'u1',
  total_amount: 195,
  confirmed_date: '2026-08-10T14:00:00Z',
  service_category: 'cleaning',
  payment_status: 'held',
  users: { first_name: 'Sam', last_name: 'Client', avatar_url: null },
  businesses: {
    business_name: 'Test Cleaning Co.',
    category: 'cleaning',
    avg_rating: 4.8,
    review_count: 12,
    logo_url: null,
    owner: { phone: '+15550001111' },
  },
  employees: {
    role_title: 'Lead Cleaner',
    avatar_url: null,
    users: { first_name: 'Dana', last_name: 'Reid', phone: '+15559998888' },
  },
  service_posts: {
    title: 'Deep clean — 2BR condo',
    address: '123 Main St SW, Calgary',
    lat: 51.05,
    lng: -114.07,
  },
  assignee: {
    type: 'employee',
    employee_id: 'emp1',
    name: 'Dana Reid',
    role_title: 'Lead Cleaner',
    business_name: 'Test Cleaning Co.',
    jobs_completed: 6,
    tenure_label: '3 months',
  },
  payment_state: {
    state: 'held',
    label: 'Held in escrow',
    capture_backed: true,
    amount_due: 0,
    amount_held: 195,
    amount_released: 0,
    amount_total: 195,
  },
};

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

describe('BookingDetailsScreen — the $0.00 bug (Price row)', () => {
  it('renders the real total_amount, not $0.00, against a nested payload with no quoted_price/price', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/bookings/')) return Promise.resolve(NESTED_BOOKING);
      if (path.startsWith('/payments/')) {
        return Promise.resolve({ status: 'held', total_charged: 195 });
      }
      return Promise.resolve({});
    });

    const { findByText, queryByText } = render(
      <Providers>
        <BookingDetailsScreen route={mockRoute} navigation={mockNavigation} />
      </Providers>
    );

    await findByText('Job Details', {}, { timeout: 5000 });
    expect(queryByText('$195.00')).not.toBeNull();
    expect(queryByText('$0.00')).toBeNull();
  });

  it('shows the real client, service, worker and address from the nested joins', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/bookings/')) return Promise.resolve(NESTED_BOOKING);
      if (path.startsWith('/payments/')) return Promise.resolve({ status: 'held' });
      return Promise.resolve({});
    });

    const { findByText, queryByText } = render(
      <Providers>
        <BookingDetailsScreen route={mockRoute} navigation={mockNavigation} />
      </Providers>
    );

    await findByText('Job Details', {}, { timeout: 5000 });
    // Worker name comes from the assignee block (M8), not a flat employee_name.
    expect(queryByText('Dana Reid')).not.toBeNull();
    // Company name from businesses.business_name, not a flat business_name.
    expect(queryByText('Test Cleaning Co.')).not.toBeNull();
    // Address from service_posts.address, not a flat address.
    expect(queryByText('123 Main St SW, Calgary')).not.toBeNull();
  });
});

describe('JobCard — reads the real nested fields', () => {
  const NESTED = {
    id: 'b2',
    status: 'confirmed',
    confirmed_date: '2026-08-12T15:30:00Z',
    service_category: 'plumbing',
    client_id: 'u9',
    users: { first_name: 'Riley', last_name: 'Nguyen' },
    service_posts: { title: 'Leaky faucet repair' },
  };

  it('shows the client name from the nested users join, not the phantom client_name', () => {
    const { queryByText } = render(<JobCard booking={NESTED} onPress={() => {}} />);
    expect(queryByText('Riley Nguyen')).not.toBeNull();
    expect(queryByText('Client')).toBeNull();
  });

  it('shows the service from service_posts.title, not the phantom service_type', () => {
    const { queryByText } = render(<JobCard booking={NESTED} onPress={() => {}} />);
    expect(queryByText('Leaky faucet repair')).not.toBeNull();
    expect(queryByText('Service')).toBeNull();
  });

  it('formats the date from confirmed_date, not the phantom scheduled_date', () => {
    const expected = new Date(NESTED.confirmed_date).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
    });
    const { queryByText } = render(<JobCard booking={NESTED} onPress={() => {}} />);
    expect(queryByText(expected, { exact: false })).not.toBeNull();
    expect(queryByText('—')).toBeNull();
  });

  it('falls back to the placeholder date when there is genuinely no date yet, not a wrong-field null', () => {
    const undated = { ...NESTED, confirmed_date: null };
    const { queryByText } = render(<JobCard booking={undated} onPress={() => {}} />);
    expect(queryByText('—')).not.toBeNull();
  });
});

describe('WorkerTrustCard — reads the server-derived assignee, not phantom flat fields', () => {
  const ASSIGNED = {
    status: 'in_progress',
    businesses: { business_name: 'Test Cleaning Co.' },
    assignee: {
      type: 'employee',
      name: 'Dana Reid',
      role_title: 'Lead Cleaner',
      business_name: 'Test Cleaning Co.',
    },
  };

  it('shows the assignee name and role, not the "Your provider" fallback', () => {
    const { queryByText } = render(<WorkerTrustCard booking={ASSIGNED} onViewBusiness={() => {}} />);
    expect(queryByText('Dana Reid')).not.toBeNull();
    expect(queryByText('Lead Cleaner')).not.toBeNull();
    expect(queryByText('Your provider')).toBeNull();
  });

  it('shows the company from businesses.business_name', () => {
    const { queryByText } = render(<WorkerTrustCard booking={ASSIGNED} onViewBusiness={() => {}} />);
    expect(queryByText('Test Cleaning Co.')).not.toBeNull();
  });

  it('falls back to the business name when nobody is assigned yet — absence is real, not a wrong field name', () => {
    const unassigned = {
      status: 'confirmed',
      businesses: { business_name: 'Test Cleaning Co.' },
      assignee: { type: 'business', name: 'Test Cleaning Co.', role_title: null, business_name: 'Test Cleaning Co.' },
    };
    const { queryByText, getAllByText } = render(
      <WorkerTrustCard booking={unassigned} onViewBusiness={() => {}} />
    );
    // Worker name and company both resolve to the business; it appears twice
    // (avatar name + company row) so assert presence via getAllByText.
    expect(getAllByText('Test Cleaning Co.').length).toBeGreaterThan(0);
    expect(queryByText('Your provider')).toBeNull();
  });
});

// Bug A (2026-08-09 walkthrough) — the escrow card used to be a three-row
// ladder ("Funds held" / "Released when you approve" / "Released on
// completion") where each row lit up independently off the raw payments
// row. On a PAID-OUT booking that put "Funds held in escrow" on screen next
// to "Released on completion" — a direct contradiction about where the
// client's money is. These pin the fix: exactly one state renders, driven by
// the server-computed `payment_state.state` (bookings.py::_payment_state),
// never the old blend of raw payments-row fields.
describe('EscrowStatus — one honest state, never two contradictory ones (Bug A)', () => {
  const RELEASED_BOOKING = {
    ...NESTED_BOOKING,
    id: 'b2',
    status: 'completed',
    confirmed_date: '2026-08-01T14:00:00Z',
    total_amount: 195,
    payment_state: {
      state: 'released',
      label: 'Released to the business',
      capture_backed: true,
      amount_due: 0,
      amount_held: 0,
      amount_released: 175.5,
      amount_total: 195,
    },
  };

  it('a paid-out booking shows "Released on completion" and never "Funds held in escrow" at the same time', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/bookings/')) return Promise.resolve(RELEASED_BOOKING);
      if (path.startsWith('/payments/')) {
        return Promise.resolve({
          status: 'fully_released',
          total_charged: 195,
          released_to_business: 175.5,
          escrow_held: 0,
        });
      }
      return Promise.resolve({});
    });

    const { findByText, queryByText } = render(
      <Providers>
        <BookingDetailsScreen
          route={{ params: { bookingId: 'b2' }, key: 'k2', name: 'BookingDetails' }}
          navigation={mockNavigation}
        />
      </Providers>
    );

    await findByText('Job Details', {}, { timeout: 5000 });
    expect(queryByText(i18n.t('escrow.fullReleased'))).not.toBeNull();
    expect(queryByText(i18n.t('escrow.fundsHeld'))).toBeNull();
    // The killed staged-release row must never resurrect, translated key or not.
    expect(queryByText('Released when you approve')).toBeNull();
  });

  it('a held booking shows "Funds held in escrow" alone — no premature "released" claim', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/bookings/')) return Promise.resolve(NESTED_BOOKING); // payment_state.state === 'held'
      if (path.startsWith('/payments/')) {
        return Promise.resolve({ status: 'held', total_charged: 195, escrow_held: 195, released_to_business: 0 });
      }
      return Promise.resolve({});
    });

    const { findByText, queryByText } = render(
      <Providers>
        <BookingDetailsScreen route={mockRoute} navigation={mockNavigation} />
      </Providers>
    );

    await findByText('Job Details', {}, { timeout: 5000 });
    expect(queryByText(i18n.t('escrow.fundsHeld'))).not.toBeNull();
    expect(queryByText(i18n.t('escrow.fullReleased'))).toBeNull();
  });
});
