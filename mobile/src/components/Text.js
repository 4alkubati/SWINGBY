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
//
// B-03 (accessibility sweep, 2026-08-10): this default was 1.3, which is
// tighter than Android's accessibility text scale (2.0x) and silently applied
// to every one of the ~300+ call sites across the app using these three
// variants, most of which were never individually audited for fixed-size
// containers. Rather than remove the cap outright — which would require
// auditing all of them for clipping — it is raised to 2.0: the documented
// ceiling for this sweep, and high enough that it is a no-op cap for the
// Android setting it exists to serve. Call sites with a real fixed-size
// constraint (e.g. BusinessLogo's avatar tile, MapPreviewCard's fixed-height
// overlay) still pass their own lower, commented override.
const CAPPED_VARIANTS = new Set(['caption', 'label', 'smallMedium']);
const BUTTON_VARIANTS = new Set(['bodyMedium', 'smallMedium', 'label']);

export default function Text({ variant = 'body', color = 'primary', style, children, maxFontSizeMultiplier, ...props }) {
  const cap = maxFontSizeMultiplier !== undefined
    ? maxFontSizeMultiplier
    : CAPPED_VARIANTS.has(variant)
      ? 2.0
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
