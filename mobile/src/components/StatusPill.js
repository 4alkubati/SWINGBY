// T74 — Status pill with animated color transition
import { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import Text from './Text';
import { colors, spacing, radius } from '../theme/tokens';

// ─── Color maps ───────────────────────────────────────────────────────────────

const STATUS_ORDER = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

const BG_COLORS = {
  confirmed:   colors.accent   + '1A',
  in_progress: colors.warning  + '1A',
  completed:   colors.success  + '1A',
  cancelled:   colors.danger   + '1A',
  pending:     colors.surfaceAlt,
};

const TEXT_COLORS = {
  confirmed:   colors.accent,
  in_progress: colors.warning,
  completed:   colors.success,
  cancelled:   colors.danger,
  pending:     colors.textSecondary,
};

const BORDER_COLORS = {
  confirmed:   colors.accent   + '66',  // ~40% opacity
  in_progress: colors.warning  + '66',
  completed:   colors.success  + '66',
  cancelled:   colors.danger   + '66',
  pending:     colors.textSecondary + '66',
};

// Map each status to an integer index used by interpolateColor
const STATUS_INDEX = Object.fromEntries(STATUS_ORDER.map((s, i) => [s, i]));

// Build parallel arrays for interpolateColor: inputRange [0,1,2,3,4]
const BG_RANGE    = STATUS_ORDER.map((s) => BG_COLORS[s]);
const BORDER_RANGE = STATUS_ORDER.map((s) => BORDER_COLORS[s]);

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Pill badge that cross-fades background and border colors when `status` changes.
 *
 * Props:
 *   status  — "confirmed" | "in_progress" | "completed" | "cancelled" | "pending"
 *   style   — optional extra ViewStyle
 */
export default function StatusPill({ status = 'pending', style }) {
  const progress = useSharedValue(STATUS_INDEX[status] ?? 0);
  // Keep a ref to the latest text color for the label (non-animated)
  const textColor = TEXT_COLORS[status] ?? colors.textSecondary;

  useEffect(() => {
    const targetIndex = STATUS_INDEX[status] ?? 0;
    progress.value = withTiming(targetIndex, {
      duration: 240,
      easing: Easing.out(Easing.quad),
    });
  }, [status]);

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = STATUS_ORDER.map((_, i) => i);
    return {
      backgroundColor: interpolateColor(progress.value, inputRange, BG_RANGE),
      borderColor:     interpolateColor(progress.value, inputRange, BORDER_RANGE),
    };
  });

  return (
    <Animated.View
      style={[
        {
          alignSelf: 'flex-start',
          borderRadius: radius.pill,
          borderWidth: 1,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm + 2,
        },
        animatedStyle,
        style,
      ]}
    >
      <Text
        variant="label"
        color={textColor}
        style={{ lineHeight: 14 }}
      >
        {status.replace('_', ' ')}
      </Text>
    </Animated.View>
  );
}
