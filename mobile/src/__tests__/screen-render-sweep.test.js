/**
 * Mount-sweep: render every screen through the provider stack with api + nav
 * mocked, and record which ones CRASH ON MOUNT. A crash here = a white-screen /
 * "doesn't show" bug (bad import, unguarded destructure, .map on undefined
 * before data loads). Data is mocked empty so we test the first-paint/empty
 * state every screen must survive.
 *
 * This is a diagnostic, not a gate — it prints a table. Real bugs it surfaces
 * get their own focused test + fix.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthProvider } from '../context/AuthContext';
import { BookingProvider } from '../context/BookingContext';
import { UnreadProvider } from '../context/UnreadContext';

jest.mock('../services/api');
import api from '../services/api';

// Nav hooks: return benign stubs so screens using useNavigation/useRoute don't
// depend on a real navigator being mounted.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(), goBack: jest.fn(), push: jest.fn(), pop: jest.fn(),
      replace: jest.fn(), setOptions: jest.fn(), setParams: jest.fn(),
      dispatch: jest.fn(), addListener: jest.fn(() => jest.fn()),
      canGoBack: () => true, getState: () => ({ routes: [] }),
    }),
    useRoute: () => ({ params: {}, key: 'sweep', name: 'Sweep' }),
    useIsFocused: () => true,
    useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => cb(), []); },
  };
});

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function AllProviders({ children }) {
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

// Every screen in the app. require() lazily inside the test so one bad import
// doesn't abort the whole file at load time.
const SCREENS = [
  ['admin/AdminScreen', () => require('../screens/admin/AdminScreen')],
  ['auth/ForgotPasswordScreen', () => require('../screens/auth/ForgotPasswordScreen')],
  ['auth/LoginScreen', () => require('../screens/auth/LoginScreen')],
  ['auth/SignupScreen', () => require('../screens/auth/SignupScreen')],
  ['business/BusinessAnalyticsScreen', () => require('../screens/business/BusinessAnalyticsScreen')],
  ['business/BusinessInvoicesScreen', () => require('../screens/business/BusinessInvoicesScreen')],
  ['business/BusinessProfileScreen', () => require('../screens/business/BusinessProfileScreen')],
  ['business/DashboardScreen', () => require('../screens/business/DashboardScreen')],
  ['business/EarningsScreen', () => require('../screens/business/EarningsScreen')],
  ['business/EmployeeManagementScreen', () => require('../screens/business/EmployeeManagementScreen')],
  ['business/EmployeeProfileScreen', () => require('../screens/business/EmployeeProfileScreen')],
  ['business/JobManagementScreen', () => require('../screens/business/JobManagementScreen')],
  ['client/ActiveBookingScreen', () => require('../screens/client/ActiveBookingScreen')],
  ['client/BookingDetailsScreen', () => require('../screens/client/BookingDetailsScreen')],
  ['client/FavoritesScreen', () => require('../screens/client/FavoritesScreen')],
  ['client/HomeScreen', () => require('../screens/client/HomeScreen')],
  ['client/MyDisputesScreen', () => require('../screens/client/MyDisputesScreen')],
  ['client/MyJobsScreen', () => require('../screens/client/MyJobsScreen')],
  ['client/NearbyMapScreen', () => require('../screens/client/NearbyMapScreen')],
  ['client/PostJobScreen', () => require('../screens/client/PostJobScreen')],
  ['client/QuoteComparisonScreen', () => require('../screens/client/QuoteComparisonScreen')],
  ['client/ReviewScreen', () => require('../screens/client/ReviewScreen')],
  ['client/SearchScreen', () => require('../screens/client/SearchScreen')],
  ['flows/CancellationFlowScreen', () => require('../screens/flows/CancellationFlowScreen')],
  ['flows/DisputeFlowScreen', () => require('../screens/flows/DisputeFlowScreen')],
  ['messages/ChatScreen', () => require('../screens/messages/ChatScreen')],
  ['messages/MessagesScreen', () => require('../screens/messages/MessagesScreen')],
  ['messages/MessageThreadScreen', () => require('../screens/messages/MessageThreadScreen')],
  ['onboarding/BusinessSetupScreen', () => require('../screens/onboarding/BusinessSetupScreen')],
  ['onboarding/OnboardingScreen', () => require('../screens/onboarding/OnboardingScreen')],
  ['profile/HelpFAQScreen', () => require('../screens/profile/HelpFAQScreen')],
  ['profile/NotificationsCenterScreen', () => require('../screens/profile/NotificationsCenterScreen')],
  ['profile/NotificationsScreen', () => require('../screens/profile/NotificationsScreen')],
  ['profile/PaymentMethodScreen', () => require('../screens/profile/PaymentMethodScreen')],
  ['profile/PrivacyPolicyScreen', () => require('../screens/profile/PrivacyPolicyScreen')],
  ['profile/ProfileEditScreen', () => require('../screens/profile/ProfileEditScreen')],
  ['profile/ProfileScreen', () => require('../screens/profile/ProfileScreen')],
  ['profile/ReferralScreen', () => require('../screens/profile/ReferralScreen')],
  ['shared/BiometricLockScreen', () => require('../screens/shared/BiometricLockScreen')],
  ['shared/InvoiceScreen', () => require('../screens/shared/InvoiceScreen')],
  ['shared/SettingsScreen', () => require('../screens/shared/SettingsScreen')],
  ['shared/TermsOfServiceScreen', () => require('../screens/shared/TermsOfServiceScreen')],
];

describe('screen mount-sweep', () => {
  beforeEach(() => {
    // list endpoints feed .map/.filter -> default to an array
    api.get.mockResolvedValue([]);
    api.post.mockResolvedValue({});
    api.put.mockResolvedValue({});
    api.patch.mockResolvedValue({});
    api.delete.mockResolvedValue({});
  });

  const crashes = [];
  it.each(SCREENS)('%s mounts without crashing', (name, load) => {
    let Screen;
    try {
      const mod = load();
      Screen = mod.default || mod;
    } catch (e) {
      crashes.push([name, 'IMPORT: ' + e.message]);
      throw e;
    }
    // Screens receive `route`/`navigation` as props from the navigator; supply
    // them so a missing prop isn't mistaken for an app bug.
    const navProp = {
      navigate: jest.fn(), goBack: jest.fn(), push: jest.fn(), pop: jest.fn(),
      replace: jest.fn(), setOptions: jest.fn(), setParams: jest.fn(),
      dispatch: jest.fn(), addListener: jest.fn(() => jest.fn()),
      canGoBack: () => true, getState: () => ({ routes: [] }),
    };
    try {
      render(
        <AllProviders>
          <Screen route={{ params: {}, key: 'sweep', name: 'Sweep' }} navigation={navProp} />
        </AllProviders>
      );
    } catch (e) {
      crashes.push([name, 'RENDER: ' + e.message]);
      throw e;
    }
  });

  afterAll(() => {
    if (crashes.length) {
      process.stderr.write('\n=== MOUNT-SWEEP CRASHES ===\n');
      crashes.forEach(([n, m]) => process.stderr.write(`  ✗ ${n}\n      ${m}\n`));
    }
  });
});
