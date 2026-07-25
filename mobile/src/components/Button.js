import React from 'react';
import { Pressable, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Text from './Text';
import { colors, radius, motion } from '../theme/tokens';
import { buttonTap } from '../services/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// "Pass"-style secondary per handoff: surfaceAlt bg, subtle border, muted 600 text.
const variants = {
  primary: {
    // accentBtn (#6D55F6) not accent (#6E56F7): the darkened step is the one
    // that passes AA with a textPrimary label. Same value the mocks use.
    bg: colors.accentBtn,
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
  iconRight,
  style,
  ...props
}) {
  const scale = useSharedValue(1);
  const pressOpacity = useSharedValue(1);
  const v = variants[variant] || variants.primary;

  // POLISH-TIPS §6 — pressed = scale 0.98 + opacity 0.9.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: pressOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
    pressOpacity.value = withSpring(0.9, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
    pressOpacity.value = withSpring(1, {
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
          // 52px tall at the default label size — the top of the 44–52 band
          // (README §6). Radius 12: square-ish, never a pill.
          minHeight: 52,
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: radius.button,
          backgroundColor: v.bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: v.border,
          // No resting shadow (§3: shadows live only on the floating nav "+"
          // and on overlapping cards/sheets).
        },
        animatedStyle,
        // POLISH-TIPS §6 — disabled is 40% opacity on the whole button, never
        // a gray recolor. Applied AFTER animatedStyle so the press-opacity
        // spring cannot clobber it.
        isDisabled && { opacity: 0.4 },
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
          {iconRight}
        </>
      )}
    </AnimatedPressable>
  );
}
