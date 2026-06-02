import React from 'react';
import { View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import SwImage from './SwImage';
import Text from './Text';
import { colors, spacing, radius, shadows, motion } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Card({ imageUri, title, subtitle, meta, actions, onPress, style }) {
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

  const Wrapper = onPress ? AnimatedPressable : Animated.View;
  const wrapperProps = onPress
    ? { onPress, onPressIn: handlePressIn, onPressOut: handlePressOut }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        shadows.subtle,
        onPress ? animatedStyle : undefined,
        style,
      ]}
    >
      {imageUri && (
        <SwImage
          source={imageUri}
          style={{ width: '100%', height: 160, backgroundColor: colors.surfaceAlt }}
        />
      )}
      <View style={{ padding: spacing.base, gap: spacing.sm }}>
        {title && <Text variant="h1">{title}</Text>}
        {subtitle && <Text variant="small" color="secondary">{subtitle}</Text>}
        {meta && <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>{meta}</View>}
        {actions && <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>{actions}</View>}
      </View>
    </Wrapper>
  );
}
