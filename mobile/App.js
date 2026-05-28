import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_700Bold, SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import ClientNavigator from './src/navigation/ClientNavigator';
import BusinessNavigator from './src/navigation/BusinessNavigator';
import { configureNotificationHandlers } from './src/services/notifications';

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

export default function App() {
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
      <AuthProvider>
        <BookingProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </BookingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
