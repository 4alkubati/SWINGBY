import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

// 11px / 600 / +1.4 tracking UPPERCASE section header per handoff.
// Optional right-aligned "See all" link in accentText.
export default function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
  variant = 'section', // 'section' | 'heading' — heading uses SG 700 17px (dashboard "New opportunities")
  count,
}) {
  const isHeading = variant === 'heading';

  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        {isHeading ? (
          <Text variant="h1" accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            {title}
          </Text>
        ) : (
          <Text
            variant="label"
            style={styles.label}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
          >
            {title}
          </Text>
        )}
        {typeof count === 'number' && count > 0 && (
          <View style={styles.countBadge}>
            <Text
              variant="caption"
              style={styles.countText}
              maxFontSizeMultiplier={1.2}
            >
              {count}
            </Text>
          </View>
        )}
      </View>

      {actionLabel && (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text
            variant="smallMedium"
            style={styles.action}
            maxFontSizeMultiplier={1.3}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    color: colors.textSecondary,
    letterSpacing: 1.4,
  },
  action: {
    color: colors.accentText,
    fontSize: 13,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 14,
  },
});
