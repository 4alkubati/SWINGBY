// T39 — Offline banner
// Mount once in App.js as <OfflineBanner /> inside SafeAreaProvider, above all navigators:
//   import OfflineBanner from './src/components/OfflineBanner';
//   <SafeAreaProvider>
//     <OfflineBanner />
//     ...rest of tree
//   </SafeAreaProvider>
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors } from '../theme/tokens';

const BANNER_HEIGHT = 32;

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;

  useEffect(() => {
    // On web, NetInfo's reachability probe fails inside sandboxed/proxied
    // contexts (e.g. the walkthrough harness) and reports "offline" while the
    // network is fine — a false positive. The mobile app doesn't ship to web,
    // so skip the banner there rather than trust an unreliable signal.
    if (Platform.OS === 'web') return undefined;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOffline =
        state.isConnected === false && state.isInternetReachable === false;
      setOffline(isOffline);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: offline ? 0 : -BANNER_HEIGHT,
      duration: offline ? 220 : 160,
      useNativeDriver: true,
    }).start();
  }, [offline, translateY]);

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <Text style={styles.label}>
        No internet connection — some features unavailable
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
