import React from 'react';
import { View } from 'react-native';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

export default function Badge({ count, dot = false, color = 'danger', style }) {
  const colorMap = {
    danger: colors.danger,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
  };
  const bg = colorMap[color] || color;

  if (dot) {
    return (
      <View
        style={[
          {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: bg,
          },
          style,
        ]}
      />
    );
  }

  if (count === undefined || count === null || count <= 0) return null;

  const displayCount = count > 99 ? '99+' : String(count);
  const minWidth = displayCount.length > 2 ? 28 : 20;

  return (
    <View
      style={[
        {
          minWidth,
          height: 20,
          borderRadius: 10,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xs,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary }}>
        {displayCount}
      </Text>
    </View>
  );
}
