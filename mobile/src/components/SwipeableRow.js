// T63 — Swipeable row with color-reveal action backgrounds
import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import { colors, spacing, radius, motion } from '../theme/tokens';
import { buttonTap } from '../services/haptics';

// Width to animate toward on action trigger before snapping back
const TRIGGER_WIDTH = 120;

/**
 * SwipeableRow
 *
 * Props:
 *   children    — the row content rendered on top
 *   leftAction  — { icon, label, color, onPress }  (revealed by swiping right)
 *   rightAction — { icon, label, color, onPress }  (revealed by swiping left)
 *   threshold   — swipe distance (px) required to trigger an action (default 80)
 *   style       — additional container styles
 */
export default function SwipeableRow({
  children,
  leftAction,
  rightAction,
  threshold = 80,
  style,
}) {
  const translateX = useSharedValue(0);

  // ---------- JS-side helpers (called via runOnJS) ----------

  const fireLeft = useCallback(() => {
    buttonTap();
    leftAction?.onPress?.();
  }, [leftAction]);

  const fireRight = useCallback(() => {
    buttonTap();
    rightAction?.onPress?.();
  }, [rightAction]);

  const snapBack = useCallback(() => {
    translateX.value = withSpring(0, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  }, [translateX]);

  const triggerAndReset = useCallback(
    (fireFn, direction) => {
      // direction: +1 = right (left action), -1 = left (right action)
      translateX.value = withTiming(
        direction * TRIGGER_WIDTH,
        { duration: 180, easing: Easing.out(Easing.quad) },
        () => {
          translateX.value = withSpring(0, {
            stiffness: motion.spring.stiffness,
            damping: motion.spring.damping,
          });
          runOnJS(fireFn)();
        },
      );
    },
    [translateX],
  );

  // ---------- Pan gesture ----------

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8]) // require intentional horizontal movement
    .failOffsetY([-12, 12]) // yield to vertical scrollers
    .onUpdate((e) => {
      const dx = e.translationX;

      // Clamp: only allow the direction that has an action defined
      if (dx > 0 && !leftAction) return;
      if (dx < 0 && !rightAction) return;

      // Rubber-band resistance past the threshold
      if (Math.abs(dx) > threshold) {
        const overshot = Math.abs(dx) - threshold;
        const damped = threshold + overshot * 0.25;
        translateX.value = dx > 0 ? damped : -damped;
      } else {
        translateX.value = dx;
      }
    })
    .onEnd(() => {
      const tx = translateX.value;

      if (tx > threshold && leftAction) {
        runOnJS(triggerAndReset)(fireLeft, 1);
      } else if (tx < -threshold && rightAction) {
        runOnJS(triggerAndReset)(fireRight, -1);
      } else {
        translateX.value = withSpring(0, {
          stiffness: motion.spring.stiffness,
          damping: motion.spring.damping,
        });
      }
    });

  // ---------- Animated styles ----------

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Left action background becomes visible when swiping right (translateX > 0)
  const leftBgStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? 1 : 0,
    width: Math.max(0, translateX.value),
  }));

  // Right action background becomes visible when swiping left (translateX < 0)
  const rightBgStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? 1 : 0,
    width: Math.max(0, -translateX.value),
  }));

  // ---------- Render ----------

  return (
    <View style={[styles.container, style]}>
      {/* Left action background — revealed by swiping right */}
      {leftAction && (
        <Animated.View
          style={[
            styles.actionBg,
            styles.leftBg,
            { backgroundColor: leftAction.color ?? colors.success },
            leftBgStyle,
          ]}
        >
          <ActionLabel icon={leftAction.icon} label={leftAction.label} />
        </Animated.View>
      )}

      {/* Right action background — revealed by swiping left */}
      {rightAction && (
        <Animated.View
          style={[
            styles.actionBg,
            styles.rightBg,
            { backgroundColor: rightAction.color ?? colors.danger },
            rightBgStyle,
          ]}
        >
          <ActionLabel icon={rightAction.icon} label={rightAction.label} />
        </Animated.View>
      )}

      {/* Draggable row content */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, rowStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ---------- Internal: action icon + label ----------

function ActionLabel({ icon, label }) {
  return (
    <View style={styles.actionLabel}>
      {icon ? (
        <Feather name={icon} size={20} color={colors.textPrimary} />
      ) : null}
      {label ? (
        <Text variant="caption" color="primary" style={styles.actionText}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  row: {
    // Sits on top of the action backgrounds
    zIndex: 1,
  },
  actionBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leftBg: {
    left: 0,
    alignItems: 'flex-start',
    paddingLeft: spacing.base,
  },
  rightBg: {
    right: 0,
    alignItems: 'flex-end',
    paddingRight: spacing.base,
  },
  actionLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  actionText: {
    marginTop: 2,
  },
});
