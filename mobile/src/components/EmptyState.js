// Empty-state block — POLISH-TIPS §8.
//
// Exact spec: "Feather icon 28px in a 64px tinted circle (#161A21), one
// 15.5px/600 line, one 13.5px #8B92A0 line, optional secondary button. No
// illustrations, no emoji."
//
// Two things were off-system before and are deliberately gone now:
//   - an infinite scale pulse on the icon. §7 reserves pulse for genuinely
//     live things (a provider on the way, a live map pin). An empty inbox is
//     the least live thing in the app.
//   - a purple CTA with a purple glow shadow. §2 gives a screen ONE primary
//     purple CTA, and an empty state is never the screen's primary action —
//     so the button is the secondary treatment (surfaceAlt + border), and §3
//     allows no resting shadow on it at all.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, radius } from '../theme/tokens';

export default function EmptyState({
  icon = 'inbox',
  title = 'Nothing here yet',
  body,
  action, // { label, onPress }
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Feather name={icon} size={28} color={colors.textSecondary} strokeWidth={1.8} />
      </View>

      <Text style={styles.title} accessibilityRole="header">{title}</Text>

      {!!body && <Text style={styles.body}>{body}</Text>}

      {action && (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.buttonLabel}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15.5,
    lineHeight: 22,
    color: colors.textPrimary,
    marginTop: spacing.base,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    maxWidth: 280,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: 13,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.9, backgroundColor: colors.surface },
  buttonLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.textSecondary,
  },
});
