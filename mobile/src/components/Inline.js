import React from 'react';
import { View } from 'react-native';
import { spacing as spacingTokens } from '../theme/tokens';

export default function Inline({ spacing = 'sm', align = 'center', justify, wrap, style, children, ...props }) {
  const gap = typeof spacing === 'number' ? spacing : spacingTokens[spacing];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: align,
          gap: gap,
        },
        justify && { justifyContent: justify },
        wrap && { flexWrap: 'wrap' },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
