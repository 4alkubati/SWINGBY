// Admin got a stack because it now has somewhere to go.
//
// AdminScreen used to be rendered bare from App.js — no navigator, so no `back`
// and no way to drill into anything. Deciding a cancellation refund means opening
// a request, studying photos, playing a voice memo and coming back out, which is
// exactly what a stack is for.
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ErrorBoundary from '../components/ErrorBoundary';
import AdminScreen from '../screens/admin/AdminScreen';
import RefundQueueScreen from '../screens/admin/RefundQueueScreen';
import RefundReviewScreen from '../screens/admin/RefundReviewScreen';

const Stack = createNativeStackNavigator();

export default function AdminNavigator() {
  return (
    <ErrorBoundary>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminHome" component={AdminScreen} />
        <Stack.Screen name="RefundQueue" component={RefundQueueScreen} />
        <Stack.Screen name="RefundReview" component={RefundReviewScreen} />
      </Stack.Navigator>
    </ErrorBoundary>
  );
}
