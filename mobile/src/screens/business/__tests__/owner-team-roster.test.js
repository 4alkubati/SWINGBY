// owner-team-roster.test.js — founder ruling 2026-07-25, the mobile half.
//
// The backend now drops the owner's own `employees` row from the PUBLIC trust
// card once a business is past SMALL_BUSINESS_MAX_TEAM_SIZE. BusinessProfileScreen
// renders BOTH the public profile and the owner's own team-management view from
// one file, and it used to feed both from the public endpoint — so the filter
// would have hidden owners from their own team list and undercounted the
// "Team & employees" stat by one.
//
// What is pinned: which ENDPOINT each view reads. The owner's view must read the
// internal roster (`GET /employees/`, always complete, the same list the assignee
// picker uses); a stranger must read the public one.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';

jest.mock('../../../services/api');

let mockUser = { id: 'u2', role: 'business_owner', first_name: 'Biz' };
jest.mock('../../../context/AuthContext', () => {
  const actual = jest.requireActual('../../../context/AuthContext');
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

// eslint-disable-next-line import/first
import api from '../../../services/api';
// eslint-disable-next-line import/first
import BusinessProfileScreen from '../BusinessProfileScreen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const BUSINESS = { id: 'biz1', business_name: 'Test Cleaning Co.', category: 'cleaning' };

const mockNavigation = {
  navigate: jest.fn(), goBack: jest.fn(), push: jest.fn(), replace: jest.fn(),
  setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()), canGoBack: () => true,
};

function Providers({ children }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation((path) => {
    if (path.startsWith('/businesses')) return Promise.resolve(BUSINESS);
    return Promise.resolve([]);
  });
});

function renderProfile(routeParams) {
  return render(
    <Providers>
      <BusinessProfileScreen
        navigation={mockNavigation}
        route={{ params: routeParams }}
      />
    </Providers>,
  );
}

/** Every /employees* path the screen asked for. */
function employeeCalls() {
  return api.get.mock.calls.map(([p]) => p).filter((p) => p.startsWith('/employees'));
}

describe('the owner reading their OWN business', () => {
  it('reads the internal roster, which always includes the owner', async () => {
    mockUser = { id: 'u2', role: 'business_owner', first_name: 'Biz' };
    renderProfile(undefined); // no businessId => "my business"

    await waitFor(() => expect(employeeCalls().length).toBeGreaterThan(0));
    expect(employeeCalls()).toEqual(['/employees/']);
    // The public card is where the size filter lives — never the owner's view.
    expect(employeeCalls()).not.toContain('/employees/business/biz1');
  });
});

describe('anyone reading someone ELSE’s business', () => {
  it('reads the public trust card, which is where the size filter applies', async () => {
    mockUser = { id: 'u1', role: 'client', first_name: 'Test' };
    renderProfile({ businessId: 'biz1' });

    await waitFor(() => expect(employeeCalls().length).toBeGreaterThan(0));
    expect(employeeCalls()).toEqual(['/employees/business/biz1']);
  });

  it('a client viewing a business is never given the internal roster', async () => {
    mockUser = { id: 'u1', role: 'client', first_name: 'Test' };
    renderProfile({ businessId: 'biz1' });

    await waitFor(() => expect(employeeCalls().length).toBeGreaterThan(0));
    // `GET /employees/` is owner-only server-side; asking for it here would 403
    // and blank the team card.
    expect(employeeCalls()).not.toContain('/employees/');
  });
});
