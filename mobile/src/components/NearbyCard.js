import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import BusinessLogo from './BusinessLogo';
import { colors, spacing, radius } from '../theme/tokens';

// Compact nearby-business row. Business logo (or purple initials tile when
// there is none — the usual case), ★ rating, distance chip.
//
// `logoUrl` is optional and `initials` is still honoured, so the callers that
// have not been given a business object with a logo on it render exactly as
// before.
export default function NearbyCard({ name, initials, logoUrl, rating, reviews, distance, onPress }) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      accessibilityRole="button"
      accessibilityLabel={
        distance
          ? `${name}, rated ${rating} stars, ${reviews} reviews, ${distance} away`
          : `${name}, rated ${rating} stars, ${reviews} reviews`
      }
      accessibilityHint="Opens business profile"
    >
      <BusinessLogo
        uri={logoUrl}
        name={name || initials}
        size={46}
        radius={14}
        fontSize={15}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.metaRow} accessible={false}>
          <Feather name="star" size={11} color={colors.textPrimary} />
          <Text style={styles.rating}>
            {rating}
          </Text>
          <Text style={styles.dotSep}>·</Text>
          <Text style={styles.meta}>
            {reviews} reviews
          </Text>
        </View>
      </View>
      {distance ? (
        <View style={styles.distPill}>
          <Text style={styles.distText}>
            {distance}
          </Text>
        </View>
      ) : null}
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
