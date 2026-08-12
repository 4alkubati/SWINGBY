import React from 'react';
import { Text as RNText, PixelRatio } from 'react-native';
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

// Every one of the 17 variants in typeScale pairs a fixed `lineHeight` with a
// `fontSize` — display1 40/48, h1 20/26, body 16/24, and so on. React Native
// scales `fontSize` by the OS font setting when allowFontScaling is on, but it
// does NOT scale a hardcoded `lineHeight`. So at Android's 2.0x accessibility
// setting every style in the app became ~2x-tall glyphs inside their original
// line box, and clipped — the exact opposite of what that setting is for, and
// invisible to anyone not using it.
//
// Fixing it in the variants themselves is not possible: a static stylesheet
// cannot know the runtime scale. Dropping lineHeight entirely would work, but
// throws away deliberate ratios (moneyLarge is 1.10, body is 1.50 — those are
// design decisions, not accidents).
//
// So the ratio is preserved and the box is scaled to match, at render time.
// `maxFontSizeMultiplier` is honoured: a capped Text stops growing at the cap,
// so its line box must stop there too or it gains dead space.
export function scaledLineHeight(variant, cap) {
  const base = typeScale[variant];
  if (!base?.lineHeight || !base?.fontSize) return null;
  const scale = Math.min(PixelRatio.getFontScale(), cap ?? Infinity);
  if (scale <= 1) return null; // untouched at default size
  return { lineHeight: base.lineHeight * scale };
}

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
        scaledLineHeight(variant, cap),
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
