import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

// Shared thin progress bar — track + fill. Replaces the near-identical
// hand-rolled {track, fill} View pairs in PostJobScreen / DisputeFlowScreen /
// BusinessAnalyticsScreen (same visual spec: 4px track, colors.border bg,
// colors.accent fill, fully rounded). No new tokens.
export default function ProgressBar({
  value = 0,
  height = 4,
  trackColor = colors.border,
  fillColor = colors.accent,
  style,
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View
        style={[
          styles.fill,
          { width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: {},
});
