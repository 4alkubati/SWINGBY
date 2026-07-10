import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import { colors, spacing, radius } from '../theme/tokens';

// Featured "TOP RATED NEAR YOU" card — 48px initials tile (purple-tinted),
// name + green Verified pill, ★ rating meta, chevron right.
export default function FeaturedCard({
  name,
  initials,
  rating,
  jobs,
  distance,
  category,
  verified,
  onPress,
}) {
  const a11yLabel = [
    name,
    verified ? 'Verified provider' : null,
    `Rated ${rating} stars`,
    `${jobs} jobs`,
    distance ? `${distance} away` : null,
    category,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.container}
      accessible
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.avatar} accessible={false}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            style={styles.name}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {name}
          </Text>
          {verified && (
            <View style={styles.verifiedPill} accessible={false}>
              <Feather
                name="check"
                size={11}
                color={colors.success}
                style={{ marginRight: 3 }}
              />
              <Text style={styles.verifiedText} maxFontSizeMultiplier={1.2}>
                Verified
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow} accessible={false}>
          <Feather name="star" size={12} color={colors.textPrimary} />
          <Text style={styles.ratingText} maxFontSizeMultiplier={1.3}>
            {rating}
          </Text>
          <Text style={styles.dotSep} maxFontSizeMultiplier={1.3}>
            ·
          </Text>
          <Text style={styles.metaText} maxFontSizeMultiplier={1.3}>
            {jobs} jobs
          </Text>
          {distance ? (
            <>
              <Text style={styles.dotSep} maxFontSizeMultiplier={1.3}>
                ·
              </Text>
              <Text style={styles.metaText} maxFontSizeMultiplier={1.3}>
                {distance}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <Feather
        name="chevron-right"
        size={22}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: colors.accentText,
    letterSpacing: -0.3,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15.5,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46,189,133,0.14)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  verifiedText: {
    fontSize: 10.5,
    color: colors.success,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dotSep: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
