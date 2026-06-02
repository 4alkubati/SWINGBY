import React from 'react';
import { Text as RNText } from 'react-native';
import { typeScale } from '../theme/typography';
import { colors } from '../theme/tokens';

const colorMap = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

// Variants that appear inside constrained UI chrome (buttons, tabs, chips, labels)
// get a cap so large-type settings don't break layout. Body copy is uncapped.
const CAPPED_VARIANTS = new Set(['caption', 'label', 'smallMedium']);
const BUTTON_VARIANTS = new Set(['bodyMedium', 'smallMedium', 'label']);

export default function Text({ variant = 'body', color = 'primary', style, children, maxFontSizeMultiplier, ...props }) {
  const cap = maxFontSizeMultiplier !== undefined
    ? maxFontSizeMultiplier
    : CAPPED_VARIANTS.has(variant)
      ? 1.3
      : undefined;

  return (
    <RNText
      style={[
        typeScale[variant],
        { color: colorMap[color] || color },
        style,
      ]}
      allowFontScaling={true}
      maxFontSizeMultiplier={cap}
      {...props}
    >
      {children}
    </RNText>
  );
}
