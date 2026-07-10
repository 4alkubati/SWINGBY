import React from 'react';
import { Pressable, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Text from './Text';
import { colors, radius, shadows, motion } from '../theme/tokens';
import { buttonTap } from '../services/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// "Pass"-style secondary per handoff: surfaceAlt bg, subtle border, muted 600 text.
const variants = {
  primary: {
    bg: colors.accent,
    text: colors.textPrimary,
    border: 'transparent',
  },
  secondary: {
    bg: colors.surfaceAlt,
    text: colors.textSecondary,
    border: colors.border,
  },
  ghost: {
    bg: 'transparent',
    text: colors.accentText,
    border: 'transparent',
  },
  danger: {
    bg: colors.danger,
    text: colors.textPrimary,
    border: 'transparent',
  },
};

export default function Button({
  variant = 'primary',
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  style,
  ...props
}) {
  const scale = useSharedValue(1);
  const v = variants[variant] || variants.primary;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  const handlePress = () => {
    if (loading || disabled) return;
    buttonTap();
    onPress?.();
  };

  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: radius.button,
          backgroundColor: v.bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: v.border,
          opacity: isDisabled ? 0.5 : 1,
        },
        variant === 'primary' && shadows.subtle,
        animatedStyle,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text variant="bodyMedium" style={{ color: v.text }} maxFontSizeMultiplier={1.3}>
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}
