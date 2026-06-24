// Web-only stub. react-native-maps is iOS/Android only — its native modules
// import "react-native/Libraries/Utilities/codegenNativeCommands" which crashes
// the web bundler. Metro automatically prefers *.web.js over *.js when
// building for web, so the real MapScreen.js continues to be used on mobile.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.card}>
        <Text style={styles.title}>Map view</Text>
        <Text style={styles.body}>
          Open the SwingBy app on your phone to browse the map.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 32,
    maxWidth: 420,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
