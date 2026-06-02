import React from 'react';
import { View } from 'react-native';
import { spacing as spacingTokens } from '../theme/tokens';

export default function Stack({ spacing = 'base', align, style, children, ...props }) {
  const gap = typeof spacing === 'number' ? spacing : spacingTokens[spacing];

  return (
    <View
      style={[
        {
          flexDirection: 'column',
          gap: gap,
        },
        align && { alignItems: align },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
