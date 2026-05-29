// T41 — SwingBy toast service
//
// ─── PASTE THIS INTO App.js ───────────────────────────────────────────────────
// import Toast from 'react-native-toast-message';
// import { toastConfig } from './src/services/toast';
//
// Inside the return of App(), as the LAST child of SafeAreaProvider (after NavigationContainer):
//   <Toast config={toastConfig} />
//
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';

// ─── Design tokens ────────────────────────────────────────────────────────────
const COLORS = {
  card: '#0d0f10',
  border: '#2a2e33',
  white: '#ffffff',
  secondary: '#9ca3af',
  success: '#4ade80',
  error: '#ef4444',
  info: '#60a5fa',
  warning: '#FF5C00',
};

// ─── Custom toast inner component ─────────────────────────────────────────────
function SwingByToast({ text1, text2, accentColor }) {
  return (
    <View style={[styles.container, { borderLeftColor: accentColor }]}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.textBlock}>
        {!!text1 && <Text style={styles.title} numberOfLines={1}>{text1}</Text>}
        {!!text2 && <Text style={styles.body} numberOfLines={2}>{text2}</Text>}
      </View>
    </View>
  );
}

// ─── Config export ────────────────────────────────────────────────────────────
export const toastConfig = {
  success: ({ text1, text2 }) => (
    <SwingByToast text1={text1} text2={text2} accentColor={COLORS.success} />
  ),
  error: ({ text1, text2 }) => (
    <SwingByToast text1={text1} text2={text2} accentColor={COLORS.error} />
  ),
  info: ({ text1, text2 }) => (
    <SwingByToast text1={text1} text2={text2} accentColor={COLORS.info} />
  ),
  warning: ({ text1, text2 }) => (
    <SwingByToast text1={text1} text2={text2} accentColor={COLORS.warning} />
  ),
};

// ─── Show helper ──────────────────────────────────────────────────────────────
export function show({ type = 'info', text1, text2, duration = 3500 } = {}) {
  Toast.show({
    type,
    text1,
    text2,
    visibilityTime: duration,
    position: 'top',
    topOffset: 60,
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  textBlock: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
    lineHeight: 20,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 2,
    lineHeight: 17,
  },
});
