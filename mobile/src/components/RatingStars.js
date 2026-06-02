// T45 — RatingStars components
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { buttonTap } from '../services/haptics';
import { colors } from '../theme/tokens';

const FILLED = colors.accent;
const EMPTY = colors.border;
const STAR_GAP = 4;

// ─── RatingStarsDisplay — read-only, supports half-stars via FontAwesome ──────
export function RatingStarsDisplay({ rating = 0, size = 14, color = colors.accent }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    let iconName;
    if (rating >= i) {
      iconName = 'star';
    } else if (rating >= i - 0.5) {
      iconName = 'star-half-o';
    } else {
      iconName = 'star-o';
    }
    stars.push(
      <FontAwesome
        key={i}
        name={iconName}
        size={size}
        color={iconName === 'star-o' ? EMPTY : color}
        style={{ marginRight: i < 5 ? STAR_GAP : 0 }}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      />
    );
  }

  return (
    <View
      style={styles.row}
      accessible={true}
      accessibilityLabel={`${rating} out of 5 stars`}
    >
      {stars}
    </View>
  );
}

// ─── RatingStarsInput — interactive 1-5 selector ──────────────────────────────
export function RatingStarsInput({ value = 0, onChange, size = 32 }) {
  const handlePress = async (star) => {
    await buttonTap();
    if (onChange) onChange(star);
  };

  return (
    <View
      style={styles.row}
      accessible={false}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => handlePress(star)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`${star} star${star !== 1 ? 's' : ''}`}
          accessibilityState={{ selected: star <= value }}
          accessibilityHint={`Rate ${star} out of 5`}
          style={{ minWidth: size + STAR_GAP, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <FontAwesome
            name={star <= value ? 'star' : 'star-o'}
            size={size}
            color={star <= value ? FILLED : EMPTY}
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
