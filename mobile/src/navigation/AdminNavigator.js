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
// Guideline 1.2 asks the developer to ACT on reports, not just collect them.
// The queue is in-app for the same reason the refund queue is: web/admin/ is
// not deployed.
import ReportQueueScreen from '../screens/admin/ReportQueueScreen';
import ReportReviewScreen from '../screens/admin/ReportReviewScreen';

const Stack = createNativeStackNavigator();

export default function AdminNavigator() {
  return (
    <ErrorBoundary>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminHome" component={AdminScreen} />
        <Stack.Screen name="RefundQueue" component={RefundQueueScreen} />
        <Stack.Screen name="RefundReview" component={RefundReviewScreen} />
        <Stack.Screen name="ReportQueue" component={ReportQueueScreen} />
        <Stack.Screen name="ReportReview" component={ReportReviewScreen} />
      </Stack.Navigator>
    </ErrorBoundary>
  );
}
