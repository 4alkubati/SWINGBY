import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

// Faint radial purple glow behind a screen header.
// radial-gradient(rgba(110,86,247,0.25) → transparent), pointer-events none.
export default function HeaderGlow({
  width = 360,
  height = 240,
  offsetTop = -40,
  align = 'right',
  opacity = 0.25,
  style,
}) {
  const cx = align === 'right' ? '85%' : align === 'left' ? '15%' : '50%';
  return (
    <Svg
      pointerEvents="none"
      style={[
        styles.abs,
        {
          top: offsetTop,
          width,
          height,
          alignSelf: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
        },
        style,
      ]}
      width={width}
      height={height}
    >
      <Defs>
        <RadialGradient id="glow" cx={cx} cy="30%" rx="60%" ry="70%">
          <Stop offset="0" stopColor="#6E56F7" stopOpacity={opacity} />
          <Stop offset="1" stopColor="#6E56F7" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
