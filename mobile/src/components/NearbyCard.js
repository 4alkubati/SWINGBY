import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import { colors, spacing, radius } from '../theme/tokens';

// Compact nearby-business row. Purple initials avatar, ★ rating, distance chip.
export default function NearbyCard({ name, initials, rating, jobs, distance, onPress }) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${name}, rated ${rating} stars, ${jobs} jobs, ${distance} away`}
      accessibilityHint="Opens business profile"
    >
      <View style={styles.avatar} accessible={false}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {name}
        </Text>
        <View style={styles.metaRow} accessible={false}>
          <Feather name="star" size={11} color={colors.textPrimary} />
          <Text style={styles.rating} maxFontSizeMultiplier={1.3}>
            {rating}
          </Text>
          <Text style={styles.dotSep} maxFontSizeMultiplier={1.3}>·</Text>
          <Text style={styles.meta} maxFontSizeMultiplier={1.3}>
            {jobs} jobs
          </Text>
        </View>
      </View>
      <View style={styles.distPill}>
        <Text style={styles.distText} maxFontSizeMultiplier={1.2}>
          {distance}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md + 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: colors.accentText,
    letterSpacing: -0.2,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dotSep: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  distPill: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  distText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
