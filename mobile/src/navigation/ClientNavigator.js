import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomNav from '../components/BottomNav';

import HomeScreen from '../screens/HomeScreen';
import MyJobsScreen from '../screens/MyJobsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';

import BusinessProfileScreen from '../screens/BusinessProfileScreen';
import EmployeeProfileScreen from '../screens/EmployeeProfileScreen';
import ActiveBookingScreen from '../screens/ActiveBookingScreen';
import QuoteComparisonScreen from '../screens/QuoteComparisonScreen';
import PostJobScreen from '../screens/PostJobScreen';
import ChatScreen from '../screens/ChatScreen';
import ReviewScreen from '../screens/ReviewScreen';
import MapScreen from '../screens/MapScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

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
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientTabs" component={ClientTabs} />
      <Stack.Screen name="BusinessProfile" component={BusinessProfileScreen} />
      <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
      <Stack.Screen name="ActiveBooking" component={ActiveBookingScreen} />
      <Stack.Screen name="QuoteComparison" component={QuoteComparisonScreen} />
      <Stack.Screen name="PostJob" component={PostJobScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
