import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.1,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
});

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

// Configure push notification display behavior once at module load time.
configureNotificationHandlers();

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#07080a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF5C00" size="large" />
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
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
