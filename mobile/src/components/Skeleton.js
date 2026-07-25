// T37 — Skeleton loader components
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';

// ─── Design tokens ────────────────────────────────────────────────────────────
// POLISH-TIPS §8: skeletons match the final card exactly (radius included),
// fill `surface`, shimmer toward `surfaceAlt`. The old #131618 / #1a1d1f pair
// were near-miss hexes for exactly those two tokens (§"common failure modes").
const SKELETON_BG = colors.skeletonBase;
const SKELETON_BORDER = colors.border;
const SKELETON_FG = colors.skeletonShimmer;
const SHIMMER_MIN = 0.4;
const SHIMMER_MAX = 0.8;
const SHIMMER_DURATION = 1200;

function useShimmer() {
  const opacity = useRef(new Animated.Value(SHIMMER_MIN)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: SHIMMER_MAX,
          duration: SHIMMER_DURATION / 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: SHIMMER_MIN,
          duration: SHIMMER_DURATION / 2,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return opacity;
}

// ─── SkeletonBox ──────────────────────────────────────────────────────────────
export function SkeletonBox({ width, height, borderRadius = radius.input, style }) {
  const opacity = useShimmer();

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: SKELETON_BG,
          borderWidth: 1,
          borderColor: SKELETON_BORDER,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── SkeletonCard — matches NearbyCard dimensions ─────────────────────────────
export function SkeletonCard() {
  const opacity = useShimmer();

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      {/* Avatar */}
      <View style={styles.avatar} />
      {/* Text lines */}
      <View style={styles.textBlock}>
        <View style={[styles.line, { width: '55%', height: 13, marginBottom: 8 }]} />
        <View style={[styles.line, { width: '40%', height: 11, marginBottom: 6 }]} />
        <View style={[styles.line, { width: '30%', height: 10 }]} />
      </View>
    </Animated.View>
  );
}

// ─── SkeletonList ─────────────────────────────────────────────────────────────
export function SkeletonList({ count = 5 }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SKELETON_BG,
    borderWidth: 1,
    borderColor: SKELETON_BORDER,
    // Matches NearbyCard: radius 20 card, 16px padding, 48px avatar tile.
    borderRadius: radius.card,
    padding: spacing.base,
    marginBottom: spacing.sm + 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: SKELETON_FG,
    marginRight: spacing.md,
  },
  textBlock: {
    flex: 1,
  },
  line: {
    borderRadius: 6,
    backgroundColor: SKELETON_FG,
  },
});
