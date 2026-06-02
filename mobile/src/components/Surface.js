import React from 'react';
import { View } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme/tokens';

const bgMap = {
  default: colors.surface,
  alt: colors.surfaceAlt,
  base: colors.bg,
};

export default function Surface({ elevation = 'subtle', background = 'default', rounded = 'card', padding = 'base', style, children, ...props }) {
  const bg = bgMap[background] || background;
  const borderRadius = typeof rounded === 'number' ? rounded : radius[rounded];
  const pad = typeof padding === 'number' ? padding : spacing[padding];
  const shadow = shadows[elevation] || shadows.none;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: borderRadius,
          padding: pad,
          borderWidth: 1,
          borderColor: colors.border,
        },
        shadow,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
