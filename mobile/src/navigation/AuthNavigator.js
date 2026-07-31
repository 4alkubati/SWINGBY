import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ErrorBoundary from '../components/ErrorBoundary';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
// Legal screens live in the logged-in stacks too, but the consent checkbox on
// Signup (and the notice on Login) link to them from OUT here. Route resolution
// is per-navigator, so without these two lines both links throw for the one
// audience that has to read them before agreeing.
import PrivacyPolicyScreen from '../screens/profile/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/shared/TermsOfServiceScreen';

const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <ErrorBoundary>
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
    </ErrorBoundary>
  );
}
