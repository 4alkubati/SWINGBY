// QuotesBubble — the docked quotes affordance on the Messages list.
//
// Spec: design/handoff-jet-pulse/MESSAGES-AND-QUOTES.md §"The bubble"
// (canvas section 5a). One component, both sides of the marketplace: the
// client sees received quotes behind it, the business sees sent quotes.
// Tapping it swaps the list in place — it never pushes a screen — so the
// bubble owns nothing but its own open/closed presentation.
//
// Docked right:16 / bottom:104 so it clears the 86px tab bar with room to
// spare; the whole pill+circle is one 56px-tall tap target.
import React, { useEffect, useRef } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { colors, shadows } from '../theme/tokens';
import Text from './Text';

// Ring pulse: 1.8s, ring expands 1 → 1.55 while fading out (README §8).
// Fired ONCE when a new quote lands — a quote never inserts a chat message,
// so this ring is the only arrival signal the inbox gets.
const PULSE_MS = 1800;

export default function QuotesBubble({
  count = 0,
  expiringSoon = 0,
  open = false,
  label,
  closedLabel,
  onPress,
  style,
}) {
  const ring = useSharedValue(0);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      ring.value = 0;
      ring.value = withSequence(
        withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      );
    }
    prevCount.current = count;
  }, [count, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - ring.value),
    transform: [{ scale: 1 + ring.value * 0.55 }],
  }));

  const a11yLabel = open
    ? (closedLabel || 'Back to chats')
    : `${label || 'Quotes'}, ${count} open${expiringSoon ? `, ${expiringSoon} expiring soon` : ''}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [styles.dock, style, pressed && styles.docked]}
    >
      {/* Left pill — attached to the circle, no right border so the two read
          as one object. Two lines closed, one line open. */}
      <View style={styles.pill}>
        {open ? (
          <Text variant="caption" style={styles.pillTitle} numberOfLines={1}>
            {closedLabel || 'Back to chats'}
          </Text>
        ) : (
          <>
            <Text variant="caption" style={styles.pillTitle} numberOfLines={1}>
              {label || 'Quotes'}
            </Text>
            <Text
              variant="caption"
              numberOfLines={1}
              style={[
                styles.pillMeta,
                { color: expiringSoon > 0 ? colors.warning : colors.textSecondary },
              ]}
            >
              {expiringSoon > 0 ? `${expiringSoon} expiring` : `${count} open`}
            </Text>
          </>
        )}
      </View>

      <View style={[styles.circle, open ? styles.circleOpen : styles.circleClosed]}>
        {!open && <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />}
        <Feather
          name={open ? 'x' : 'briefcase'}
          size={open ? 21 : 22}
          strokeWidth={1.8}
          color={open ? colors.textSecondary : colors.textPrimary}
        />
        {!open && count > 0 && (
          <View style={styles.badge}>
            <Text variant="caption" style={styles.badgeText} numberOfLines={1}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    right: 16,
    bottom: 104,
    flexDirection: 'row',
    alignItems: 'center',
  },
  docked: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  pill: {
    height: 42,
    paddingLeft: 15,
    paddingRight: 13,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: colors.border,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  pillTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    lineHeight: 15,
    color: colors.textPrimary,
  },
  pillMeta: {
    fontSize: 10.5,
    lineHeight: 14,
  },

  circle: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleClosed: {
    backgroundColor: colors.accent,
    ...shadows.accentGlow,
  },
  circleOpen: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ring: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.accent,
  },

  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 21,
    height: 21,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11.5,
    lineHeight: 14,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
