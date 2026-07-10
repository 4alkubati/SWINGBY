import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import EarningsSparkline from './EarningsSparkline';
import { colors, spacing } from '../theme/tokens';

// Sanctioned "gradient earnings hero" card. 135deg purple-charcoal gradient
// with inner top-right radial glow, purple-tinted border. Money in success green
// deltas but the big $ amount is textPrimary — per handoff.
export default function EarningsHero({
  amount,
  deltaPct = null,
  data,
  height = 172,
}) {
  const hasDelta = deltaPct != null && Number.isFinite(deltaPct);
  const deltaUp = hasDelta && deltaPct >= 0;
  return (
    <View style={styles.wrap}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="earnBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#2A2247" stopOpacity="1" />
            <Stop offset="0.6" stopColor="#1A1533" stopOpacity="1" />
            <Stop offset="1" stopColor="#141127" stopOpacity="1" />
          </LinearGradient>
          <RadialGradient id="earnGlow" cx="85%" cy="15%" rx="60%" ry="80%">
            <Stop offset="0" stopColor="#8878F9" stopOpacity="0.2" />
            <Stop offset="1" stopColor="#8878F9" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#earnBg)" rx="22" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#earnGlow)" rx="22" />
      </Svg>

      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow} maxFontSizeMultiplier={1.3}>
              THIS WEEK
            </Text>
            <Text style={styles.amount} maxFontSizeMultiplier={1.2}>
              {amount}
            </Text>
            {hasDelta && (
              <View style={styles.deltaRow}>
                <Feather
                  name={deltaUp ? 'trending-up' : 'trending-down'}
                  size={13}
                  color={deltaUp ? colors.success : colors.danger}
                  strokeWidth={2.2}
                />
                <Text
                  style={[styles.delta, !deltaUp && { color: colors.danger }]}
                  maxFontSizeMultiplier={1.3}
                >
                  {`${deltaUp ? '+' : ''}${deltaPct}% vs last week`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {data && data.length > 0 ? (
          <View style={styles.sparklineWrap}>
            <EarningsSparkline data={data} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    overflow: 'hidden',
    backgroundColor: '#141127',
  },
  inner: {
    padding: spacing.base + 2,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.accentSoft,
  },
  amount: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.5,
    color: colors.textPrimary,
    marginTop: 6,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  delta: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  sparklineWrap: {
    marginTop: -6,
  },
});
