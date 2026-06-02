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
          borderRadius: radius.chip,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.border,
        },
        animatedStyle,
        style,
      ]}
    >
      {icon}
      <Text
        variant="smallMedium"
        color={selected ? 'accent' : 'secondary'}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
