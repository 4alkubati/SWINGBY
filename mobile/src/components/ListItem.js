import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
          // POLISH-TIPS §4 — list rows get 14px+ vertical padding and a
          // 44px minimum hit area (§6).
          paddingVertical: 15,
          paddingHorizontal: spacing.base,
          minHeight: 56,
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
        <Feather name="chevron-right" size={18} strokeWidth={1.8} color={colors.textSecondary} />
      )}
    </AnimatedPressable>
  );
}
