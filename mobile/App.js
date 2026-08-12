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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, AppState } from 'react-native';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_700Bold, SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { UnreadProvider } from './src/context/UnreadContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import ClientNavigator from './src/navigation/ClientNavigator';
import BusinessNavigator from './src/navigation/BusinessNavigator';
import AdminNavigator from './src/navigation/AdminNavigator';
import BiometricLockScreen from './src/screens/shared/BiometricLockScreen';
import { getBiometricPref, isBiometricAvailable } from './src/services/biometrics';
import { configureNotificationHandlers, registerNotificationResponseHandler } from './src/services/notifications';
import { navigationRef } from './src/services/navigationRef';
import OfflineBanner from './src/components/OfflineBanner';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/services/toast';
import { linkingConfig } from './src/services/linking';
import { useAuthDeepLink } from './src/hooks/useAuthDeepLink';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { colors } from './src/theme/tokens';

// Configure push notification display behavior once at module load time.
configureNotificationHandlers();

// Every "not ready yet" state in this file renders THIS — never `null`. A root
// component that returns null renders nothing, and nothing is a bare white
// screen, because no expo-splash-screen call is holding the native splash for
// us (the package is not installed). A dark branded screen with a spinner reads
// as loading; a white void reads as a broken install, and carries no
// information the user could report back.
function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

// How long the app waits on webfonts before it gives up and draws in the system
// face. Long enough that nobody on a slow connection sees a typeface change,
// short enough that a hung load does not read as a dead app.
const FONT_TIMEOUT_MS = 5000;

function RootNavigator() {
  const { user, isLoading, restoredFromStorage, logout, adoptSession } = useAuth();

  // M2 — an email confirmation / magic link tapped from the client's inbox.
  // Lives here rather than in linkingConfig because the link arrives while the
  // user is logged OUT, and none of the navigators that own routable screens
  // are mounted yet. Completing the session sets `user`, and the swap below
  // happens on its own. See services/authLink.js.
  //
  // The hook is mounted unconditionally (it's a hook), but a link can arrive
  // while `user` IS already set — a stale tab, a second test account's mail,
  // Gmail's own link-preview crawler. Passing `!!user` lets the hook no-op in
  // that case instead of overwriting the live session. See F003.
  const { busy: authLinkBusy } = useAuthDeepLink(adoptSession, !!user);

  // CARD-24 biometric app-lock. Gates only the cold-boot "resumed from a
  // stored token" path — never an interactive login/signup just now — and
  // only when the user opted in AND the device actually has biometrics
  // enrolled. Either condition failing means `locked` never turns true, so
  // an unopted-in or unenrolled user sails straight through: no lockout.
  const [locked, setLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);
  const appState = useRef(AppState.currentState);
  const pendingRelock = useRef(false);

  // useLayoutEffect (not useEffect) so this fires before the frame commits —
  // without it, the moment AuthContext resolves user+isLoading together, one
  // frame of the real navigator can flash before the lock re-engages.
  useLayoutEffect(() => {
    if (!user || !restoredFromStorage) {
      setCheckingLock(false);
      return;
    }
    // Hold the loading state for this pass — the async block below resolves
    // it to true (locked) or false (no lock configured) a moment later.
    setCheckingLock(true);
    let cancelled = false;
    (async () => {
      const enabled = await getBiometricPref();
      if (!enabled) {
        if (!cancelled) setCheckingLock(false);
        return;
      }
      const available = await isBiometricAvailable();
      if (!cancelled) {
        if (available) setLocked(true);
        setCheckingLock(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, restoredFromStorage]);

  // Re-lock on foreground resume, same opt-in-and-available gate as above.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const prev = appState.current;
      if (prev.match(/active/) && next === 'background') {
        pendingRelock.current = true;
      } else if (prev === 'background' && next === 'active' && pendingRelock.current) {
        pendingRelock.current = false;
        if (user) {
          const enabled = await getBiometricPref();
          if (enabled) {
            const available = await isBiometricAvailable();
            if (available) setLocked(true);
          }
        }
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [user]);

  // Hold the spinner while a confirmation link is being exchanged. Without
  // this the client watches the login screen appear and then vanish, which
  // reads as "it failed" at the exact moment it is working.
  if (isLoading || checkingLock || authLinkBusy) return <LoadingScreen />;

  if (!user) return <AuthNavigator />;

  if (locked) {
    return (
      <BiometricLockScreen
        onUnlocked={() => setLocked(false)}
        onUseDifferentAccount={logout}
      />
    );
  }

  // A stack now, not a bare screen: refund decisions drill into a queue and a
  // review, which needs somewhere to go back to.
  if (user.role === 'admin') return <AdminNavigator />;
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

  // F118 — tap-to-navigate for push notifications. Registered once at app
  // root, independent of auth/role state, since a tap can cold-start the app
  // before any of that has resolved (handleNotificationResponse just no-ops
  // until navigationRef.isReady()).
  useEffect(() => {
    const unsubscribe = registerNotificationResponseHandler();
    return unsubscribe;
  }, []);

  // The font load is not allowed to hold the whole app hostage.
  //
  // This line used to be `if (!fontsLoaded && !fontError) return null` — the
  // only path in the app that rendered NOTHING. Every other pending state
  // draws LoadingScreen. With nothing holding the native splash, "nothing" is
  // a white screen for as long as the load takes, and if the promise never
  // settles it is a permanent white screen with no spinner, no error, and
  // nothing in it anyone could report. That is what the 2026-08-11 iOS
  // development build showed.
  //
  // `fontError` already fell through to a normal render, so a font that FAILED
  // was survivable and only a font that HUNG was fatal. Time the wait out and
  // treat a hang like the failure it is: the system typeface is wrong, and
  // wrong beats absent.
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return undefined;
    const timer = setTimeout(() => setFontsTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !fontsTimedOut) return <LoadingScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar style="light" />
          <OfflineBanner />
          <AuthProvider>
            <BookingProvider>
              <UnreadProvider>
                <NavigationContainer ref={navigationRef} linking={linkingConfig}>
                  <RootNavigator />
                </NavigationContainer>
              </UnreadProvider>
            </BookingProvider>
          </AuthProvider>
          <Toast config={toastConfig} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Only wrap with Sentry when Sentry actually loaded successfully.
// Sentry.wrap() touches native modules even when init was skipped.
export default Sentry ? Sentry.wrap(App) : App;
