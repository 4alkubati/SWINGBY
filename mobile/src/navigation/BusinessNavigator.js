import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomNav from '../components/BottomNav';
import ErrorBoundary from '../components/ErrorBoundary';
import { api } from '../services/api';
import { colors } from '../theme/tokens';

import DashboardScreen from '../screens/business/DashboardScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import BusinessProfileScreen from '../screens/business/BusinessProfileScreen';
import BusinessSetupScreen from '../screens/onboarding/BusinessSetupScreen';

import JobManagementScreen from '../screens/business/JobManagementScreen';
import ChatScreen from '../screens/messages/ChatScreen';
import EmployeeManagementScreen from '../screens/business/EmployeeManagementScreen';
import EmployeeProfileScreen from '../screens/business/EmployeeProfileScreen';
import EarningsScreen from '../screens/business/EarningsScreen';
import BusinessAnalyticsScreen from '../screens/business/BusinessAnalyticsScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import PrivacyPolicyScreen from '../screens/profile/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/shared/TermsOfServiceScreen';
import HelpFAQScreen from '../screens/profile/HelpFAQScreen';
import NotificationsCenterScreen from '../screens/profile/NotificationsCenterScreen';
import BookingDetailsScreen from '../screens/client/BookingDetailsScreen';
import MessageThreadScreen from '../screens/messages/MessageThreadScreen';
import PaymentMethodScreen from '../screens/profile/PaymentMethodScreen';
import DisputeFlowScreen from '../screens/flows/DisputeFlowScreen';
import InvoiceScreen from '../screens/shared/InvoiceScreen';
import BusinessInvoicesScreen from '../screens/business/BusinessInvoicesScreen';
import ProfileEditScreen from '../screens/profile/ProfileEditScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const BUSINESS_TABS = [
  { name: 'Dashboard' },
  { name: 'Jobs' },
  { name: 'Messages' },
  { name: 'My Business' },
];

function BusinessTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNav {...props} tabs={BUSINESS_TABS} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      {/* CARD-24 — Jobs is now the operational hub (Today/Upcoming/Needs
          action/Past), not the client-shaped Active/Past/Quotes list. */}
      <Tab.Screen name="Jobs" component={JobManagementScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="My Business" component={BusinessProfileScreen} />
    </Tab.Navigator>
  );
}

export default function BusinessNavigator() {
  // Gate the business UI on having a business record. New business_owner accounts
  // must complete BusinessSetupScreen first (name, category, address, radius)
  // before they can reach the dashboard / job feed / etc.
  const [setupStatus, setSetupStatus] = useState('loading'); // 'loading' | 'needs-setup' | 'ready'

  useEffect(() => {
    (async () => {
      try {
        const biz = await api.get('/businesses/me');
        // A complete business needs at minimum a name and a category. Force
        // BusinessSetupScreen if either is missing (e.g. partial record from
        // an earlier flow).
        const isComplete = biz && biz.business_name && biz.category;
        setSetupStatus(isComplete ? 'ready' : 'needs-setup');
      } catch {
        // 404 / "no business" — needs setup
        setSetupStatus('needs-setup');
      }
    })();
  }, []);

  if (setupStatus === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (setupStatus === 'needs-setup') {
    return (
      <ErrorBoundary>
        <BusinessSetupScreen onComplete={() => setSetupStatus('ready')} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BusinessTabs" component={BusinessTabs} />
      <Stack.Screen name="JobManagement" component={JobManagementScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="EmployeeManagement" component={EmployeeManagementScreen} />
      <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
      <Stack.Screen name="Earnings" component={EarningsScreen} />
      <Stack.Screen name="BusinessAnalytics" component={BusinessAnalyticsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="HelpFAQ" component={HelpFAQScreen} />
      <Stack.Screen name="NotificationsCenter" component={NotificationsCenterScreen} />
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} />
      <Stack.Screen name="DisputeFlow" component={DisputeFlowScreen} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BusinessInvoices" component={BusinessInvoicesScreen} />
      {/* SettingsScreen ("Edit profile") is registered in BOTH navigators and
          navigates to `ProfileEdit` with no role guard — business owners and
          employees previously hit a dead route and had no way to edit their
          own name / phone / avatar. ProfileEditScreen is role-neutral (it only
          touches PATCH /auth/me + POST /uploads/image), so registering it here
          is the fix rather than hiding the row. */}
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      {/* BookingDetailsScreen and EmployeeProfileScreen both navigate to a
          route literally named `BusinessProfile`. In this navigator the same
          component is only mounted as the "My Business" TAB, so the route name
          did not resolve. Register it as a stack route (same component,
          driven by the businessId param) so the company link works for
          business users too — one route instead of per-call-site conditionals. */}
      <Stack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
    </Stack.Navigator>
    </ErrorBoundary>
  );
}
