import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';
import { CATEGORIES as CANONICAL_CATEGORIES } from '../constants/categories';

// Category label + Feather icon name (stroke ~1.8). Replaces emoji taxonomy.
// Re-exported (not redefined) so existing importers (SearchScreen, NearbyMap)
// keep working off the single canonical taxonomy in ../constants/categories.
export const CATEGORIES = CANONICAL_CATEGORIES;

const ALL_CATEGORY = { id: 'all', label: 'All', icon: 'search' };

// Horizontal scroll variant kept for SearchScreen / NearbyMap filter row.
export default function CategoryScroll({ activeCategory, onSelect, prependAll = false }) {
  const items = prependAll ? [ALL_CATEGORY, ...CATEGORIES] : CATEGORIES;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContainer}
    >
      {items.map((cat) => {
        const active = activeCategory === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={cat.label}
            accessibilityState={{ selected: active }}
          >
            <Feather
              name={cat.icon}
              size={16}
              color={active ? colors.accentText : colors.textSecondary}
              strokeWidth={1.8}
            />
            <Text
              style={[styles.label, { color: active ? colors.textPrimary : colors.textSecondary }]}
              maxFontSizeMultiplier={1.3}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// 4-column grid variant used on the Home screen — 56px icon tiles + label under.
// pass `data` to override the default list, or `columns` to change column count.
export function CategoryGrid({
  activeCategory,
  onSelect,
  data = CATEGORIES.slice(0, 3),
  onMorePress,
  showMore = true,
}) {
  const cells = showMore
    ? [...data, { id: 'more', label: 'More', icon: 'grid' }]
    : data;

  return (
    <View style={styles.grid}>
      {cells.map((cat) => {
        const active = activeCategory === cat.id;
        const isMore = cat.id === 'more';
        return (
          <TouchableOpacity
            key={cat.id}
            style={styles.cell}
            activeOpacity={0.85}
            onPress={() => (isMore ? onMorePress?.() : onSelect?.(cat.id))}
            accessibilityRole="button"
            accessibilityLabel={cat.label}
            accessibilityState={{ selected: active }}
          >
            <View
              style={[
                styles.tile,
                active && styles.tileActive,
              ]}
            >
              <Feather
                name={cat.icon}
                size={22}
                color={active ? colors.accentText : colors.textSecondary}
                strokeWidth={1.8}
              />
            </View>
            <Text
              style={[
                styles.gridLabel,
                { color: active ? colors.textPrimary : colors.textSecondary },
              ]}
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.borderAccent,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.borderAccent,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
