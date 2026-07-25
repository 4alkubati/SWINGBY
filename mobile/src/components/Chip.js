import React from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Text from './Text';
import { colors, spacing, radius, motion } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Chip({ label, icon, selected = false, onPress, style }) {
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withSpring(
      selected ? colors.accentMuted : colors.surface,
      { stiffness: motion.spring.stiffness, damping: motion.spring.damping }
    ),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          // ≥44px hit area even though the visual is ~36px (POLISH-TIPS §6).
          minHeight: 36,
          borderRadius: radius.chip,
          borderWidth: 1,
          // Selected border is the purple-tinted borderAccent, not solid
          // accent — a solid purple outline on every selected chip breaks the
          // purple-scarcity rule (§2).
          borderColor: selected ? colors.borderAccent : colors.border,
        },
        animatedStyle,
        style,
      ]}
      hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
    >
      {icon}
      <Text
        variant="smallMedium"
        // Purple TEXT is always accentText — accent (#6E56F7) fails contrast
        // on dark (§2).
        style={{ color: selected ? colors.accentText : colors.textSecondary }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
