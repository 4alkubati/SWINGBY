import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomNav from '../components/BottomNav';
import ErrorBoundary from '../components/ErrorBoundary';

import HomeScreen from '../screens/client/HomeScreen';
import MyJobsScreen from '../screens/client/MyJobsScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

import BusinessProfileScreen from '../screens/business/BusinessProfileScreen';
import EmployeeProfileScreen from '../screens/business/EmployeeProfileScreen';
import ActiveBookingScreen from '../screens/client/ActiveBookingScreen';
import QuoteComparisonScreen from '../screens/client/QuoteComparisonScreen';
import PostJobScreen from '../screens/client/PostJobScreen';
import ChatScreen from '../screens/messages/ChatScreen';
import ReviewScreen from '../screens/client/ReviewScreen';
import NotificationsScreen from '../screens/profile/NotificationsScreen';
import SearchScreen from '../screens/client/SearchScreen';
import FavoritesScreen from '../screens/client/FavoritesScreen';
import NearbyMapScreen from '../screens/client/NearbyMapScreen';
import ProfileEditScreen from '../screens/profile/ProfileEditScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import PrivacyPolicyScreen from '../screens/profile/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/shared/TermsOfServiceScreen';
import HelpFAQScreen from '../screens/profile/HelpFAQScreen';
import ReferralScreen from '../screens/profile/ReferralScreen';
import NotificationsCenterScreen from '../screens/profile/NotificationsCenterScreen';
import BookingDetailsScreen from '../screens/client/BookingDetailsScreen';
import MessageThreadScreen from '../screens/messages/MessageThreadScreen';
import CancellationFlowScreen from '../screens/flows/CancellationFlowScreen';
import PaymentMethodScreen from '../screens/profile/PaymentMethodScreen';
import DisputeFlowScreen from '../screens/flows/DisputeFlowScreen';
import InvoiceScreen from '../screens/shared/InvoiceScreen';
import MyDisputesScreen from '../screens/client/MyDisputesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ClientTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="My Jobs" component={MyJobsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function ClientNavigator() {
  return (
    <ErrorBoundary>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientTabs" component={ClientTabs} />
      <Stack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
      <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
      <Stack.Screen name="ActiveBooking" component={ActiveBookingScreen} />
      <Stack.Screen name="QuoteComparison" component={QuoteComparisonScreen} />
      <Stack.Screen name="PostJob" component={PostJobScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="NearbyMap" component={NearbyMapScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="HelpFAQ" component={HelpFAQScreen} />
      <Stack.Screen name="ReferralScreen" component={ReferralScreen} />
      <Stack.Screen name="NotificationsCenter" component={NotificationsCenterScreen} />
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CancellationFlow" component={CancellationFlowScreen} />
      <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} />
      <Stack.Screen name="DisputeFlow" component={DisputeFlowScreen} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MyDisputes" component={MyDisputesScreen} />
    </Stack.Navigator>
    </ErrorBoundary>
  );
}
