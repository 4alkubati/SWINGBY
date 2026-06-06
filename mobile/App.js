// react-native-gesture-handler MUST be imported before any other React Native
// code so Android registers its native module. Do not move this line.
import 'react-native-gesture-handler';

import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  'expo-notifications',
  'Notifications.setNotificationHandler',
]);

import Constants from 'expo-constants';

// @sentry/react-native@8 probes for native modules at MODULE IMPORT time,
// before any code can guard it. In Expo Go those native modules don't exist,
// so the JSI probe throws "Exception in HostFunction" and crashes the runtime
// before the first React render. Load Sentry lazily via require() so the
// module is only evaluated when we are NOT inside Expo Go.
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';
const sentryEnabled =
  !isExpoGo && !!process.env.EXPO_PUBLIC_SENTRY_DSN;

let Sentry = null;
if (sentryEnabled) {
  try {
    Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.1,
    });
  } catch {
    Sentry = null;
  }
}

import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_700Bold, SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { UnreadProvider } from './src/context/UnreadContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import ClientNavigator from './src/navigation/ClientNavigator';
import BusinessNavigator from './src/navigation/BusinessNavigator';
import { configureNotificationHandlers } from './src/services/notifications';
import OfflineBanner from './src/components/OfflineBanner';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/services/toast';
import { linkingConfig } from './src/services/linking';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { colors } from './src/theme/tokens';

// Configure push notification display behavior once at module load time.
configureNotificationHandlers();

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!user) return <AuthNavigator />;
  if (user.role === 'business_owner' || user.role === 'employee') return <BusinessNavigator />;
  return <ClientNavigator />;
}

function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_700Bold,
    SpaceGrotesk_400Regular,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="light" />
        <OfflineBanner />
        <AuthProvider>
          <BookingProvider>
            <UnreadProvider>
              <NavigationContainer linking={linkingConfig}>
                <RootNavigator />
              </NavigationContainer>
            </UnreadProvider>
          </BookingProvider>
        </AuthProvider>
        <Toast config={toastConfig} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Only wrap with Sentry when Sentry actually loaded successfully.
// Sentry.wrap() touches native modules even when init was skipped.
export default Sentry ? Sentry.wrap(App) : App;
