import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Text from './Text';
import { colors, spacing, radius, motion } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ListItem({ title, subtitle, left, right, onPress, showChevron = true, style, titleStyle }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.base,
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
        },
        animatedStyle,
        style,
      ]}
    >
      {left && <View>{left}</View>}
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" style={titleStyle}>{title}</Text>
        {subtitle && <Text variant="small" color="secondary" numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right && <View>{right}</View>}
      {showChevron && !right && (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      )}
    </AnimatedPressable>
  );
}
