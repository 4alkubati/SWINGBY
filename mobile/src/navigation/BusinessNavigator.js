import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomNav from '../components/BottomNav';

import DashboardScreen from '../screens/DashboardScreen';
import MessagesScreen from '../screens/MessagesScreen';
import BusinessProfileScreen from '../screens/BusinessProfileScreen';
import MyJobsScreen from '../screens/MyJobsScreen';

import JobManagementScreen from '../screens/JobManagementScreen';
import ChatScreen from '../screens/ChatScreen';
import EmployeeManagementScreen from '../screens/EmployeeManagementScreen';
import EmployeeProfileScreen from '../screens/EmployeeProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EarningsScreen from '../screens/EarningsScreen';
import BusinessAnalyticsScreen from '../screens/BusinessAnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import HelpFAQScreen from '../screens/HelpFAQScreen';
import NotificationsCenterScreen from '../screens/NotificationsCenterScreen';
import BookingDetailsScreen from '../screens/BookingDetailsScreen';
import MessageThreadScreen from '../screens/MessageThreadScreen';
import PaymentMethodScreen from '../screens/PaymentMethodScreen';
import DisputeFlowScreen from '../screens/DisputeFlowScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const BUSINESS_TABS = [
  { name: 'Dashboard', icon: '📊' },
  { name: 'Jobs', icon: '📄' },
  { name: 'Messages', icon: '💬' },
  { name: 'My Business', icon: '🏢' },
];

function BusinessTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNav {...props} tabs={BUSINESS_TABS} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Jobs" component={MyJobsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="My Business" component={BusinessProfileScreen} />
    </Tab.Navigator>
  );
}

export default function BusinessNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BusinessTabs" component={BusinessTabs} />
      <Stack.Screen name="JobManagement" component={JobManagementScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="EmployeeManagement" component={EmployeeManagementScreen} />
      <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
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
    </Stack.Navigator>
  );
}
