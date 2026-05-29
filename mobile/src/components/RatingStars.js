// T45 — RatingStars components
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { buttonTap } from '../services/haptics';

const FILLED = '#FF5C00';
const EMPTY = '#2a2e33';
const STAR_GAP = 4;

// ─── RatingStarsDisplay — read-only, supports half-stars via FontAwesome ──────
export function RatingStarsDisplay({ rating = 0, size = 14, color = '#FF5C00' }) {
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
      />
    );
  }

  return <View style={styles.row}>{stars}</View>;
}

// ─── RatingStarsInput — interactive 1-5 selector ──────────────────────────────
export function RatingStarsInput({ value = 0, onChange, size = 32 }) {
  const handlePress = async (star) => {
    await buttonTap();
    if (onChange) onChange(star);
  };

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => handlePress(star)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          style={{ minWidth: size + STAR_GAP, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <FontAwesome
            name={star <= value ? 'star' : 'star-o'}
            size={size}
            color={star <= value ? FILLED : EMPTY}
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
