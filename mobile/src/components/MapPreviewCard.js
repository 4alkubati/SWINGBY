import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Line,
  G,
  Circle,
  Path,
} from 'react-native-svg';
import Text from './Text';
import PulseDot from './PulseDot';
import { colors, radius, spacing } from '../theme/tokens';

// Faux "map" background: dark blue-tinted gradient + faint 34px grid overlay.
// Used as home map preview and as base for the ActiveBooking hero.
export function MapCanvas({ children, style }) {
  return (
    <View style={[styles.canvas, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.mapBgTop} stopOpacity="1" />
            <Stop offset="0.55" stopColor={colors.mapBgMid} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.mapBgBottom} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#mapBg)" />
        <MapGridOverlay />
      </Svg>
      {children}
    </View>
  );
}

// 34px grid, ~5% opacity purple lines.
function MapGridOverlay() {
  const stroke = 'rgba(136,120,249,0.05)';
  const step = 34;
  const cols = new Array(20).fill(0);
  const rows = new Array(20).fill(0);
  return (
    <G>
      {cols.map((_, i) => (
        <Line
          key={`c-${i}`}
          x1={i * step}
          y1={0}
          x2={i * step}
          y2="100%"
          stroke={stroke}
          strokeWidth={1}
        />
      ))}
      {rows.map((_, i) => (
        <Line
          key={`r-${i}`}
          x1={0}
          y1={i * step}
          x2="100%"
          y2={i * step}
          stroke={stroke}
          strokeWidth={1}
        />
      ))}
    </G>
  );
}

// Small purple pin dot with soft ring (or green when top-rated).
export function MapPin({ x, y, top = false }) {
  const color = top ? colors.success : colors.accent;
  return (
    <G>
      <Circle cx={x} cy={y} r={14} fill={color} fillOpacity={0.18} />
      <Circle cx={x} cy={y} r={6} fill={color} />
    </G>
  );
}

// Dashed 4px-dotted purple route between two SVG points.
export function MapRoute({ points }) {
  if (!points || points.length < 2) return null;
  const d = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');
  return (
    <Path
      d={d}
      stroke={colors.accent}
      strokeWidth={3}
      strokeDasharray="1 8"
      strokeLinecap="round"
      fill="none"
    />
  );
}

// Complete Home "map preview" card with default decoration + bottom overlay.
export default function MapPreviewCard({
  height = 170,
  countLabel = '12 pros near you',
  areaLabel = 'Kensington · Calgary',
  actionLabel = 'Open map',
  onPress,
  style,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${countLabel}, ${actionLabel}`}
      style={[styles.wrap, { height }, style]}
    >
      <MapCanvas>
        {/* Decorative SVG pins on top of the map canvas */}
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          pointerEvents="none"
        >
          <MapPin x={64} y={54} />
          <MapPin x={148} y={92} />
          <MapPin x={242} y={62} top />
          <MapPin x={196} y={128} />
          <MapPin x={98} y={128} />
        </Svg>

        {/* Bottom overlay bar */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayLeft}>
            <Feather
              name="map-pin"
              size={13}
              color={colors.accentText}
              style={{ marginRight: 6 }}
            />
            <View>
              <Text variant="smallMedium" maxFontSizeMultiplier={1.3}>
                {countLabel}
              </Text>
              <Text variant="caption" color="secondary" maxFontSizeMultiplier={1.3}>
                {areaLabel}
              </Text>
            </View>
          </View>
          <View style={styles.overlayRight}>
            <Text
              variant="smallMedium"
              style={{ color: colors.accentText, fontSize: 13 }}
              maxFontSizeMultiplier={1.3}
            >
              {actionLabel}
            </Text>
            <Feather
              name="arrow-right"
              size={14}
              color={colors.accentText}
              style={{ marginLeft: 4 }}
            />
          </View>
        </View>
      </MapCanvas>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.mapBgMid,
  },
  overlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.overlayScrim,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  overlayRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
