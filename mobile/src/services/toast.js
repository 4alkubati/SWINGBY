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
import { colors, radius, spacing } from '../theme/tokens';

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
    <SwingByToast text1={text1} text2={text2} accentColor={colors.success} />
  ),
  error: ({ text1, text2 }) => (
    <SwingByToast text1={text1} text2={text2} accentColor={colors.danger} />
  ),
  info: ({ text1, text2 }) => (
    <SwingByToast text1={text1} text2={text2} accentColor={colors.accent} />
  ),
  warning: ({ text1, text2 }) => (
    <SwingByToast text1={text1} text2={text2} accentColor={colors.warning} />
  ),
};

// ─── Show helper ──────────────────────────────────────────────────────────────
export function show({ type = 'info', text1, text2, duration = 4000 } = {}) {
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
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    marginHorizontal: spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  textBlock: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
});
