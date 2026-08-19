import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
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
import i18n from '../i18n';

// Sanctioned "gradient earnings hero" card. 135deg purple-charcoal gradient
// with inner top-right radial glow, purple-tinted border. Money in success green
// deltas but the big $ amount is textPrimary — per handoff.
// B18 — the hero was a plain View, so the week's number was the biggest thing
// on the dashboard and the only thing you could not touch. `onPress` turns the
// whole card into a target (with a pressed state and an a11y label); without
// it the card renders exactly as before.
// `caption` (M5, 2026-07-31): "THIS WEEK $590" sat above a card reading
// "Cleared $75" with no word explaining why the two disagreed. The number is
// honest now; the caption says which number it is.
export default function EarningsHero({
  amount,
  caption = null,
  deltaPct = null,
  data,
  height = 172,
  onPress,
  accessibilityLabel,
}) {
  const hasDelta = deltaPct != null && Number.isFinite(deltaPct);
  const deltaUp = hasDelta && deltaPct >= 0;
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? (accessibilityLabel || `${i18n.t('dashboard.thisWeek')} ${amount}`) : undefined}
      // View does not accept a function style, so only the Pressable branch
      // gets one.
      style={onPress
        ? ({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]
        : styles.wrap}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="earnBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.earningsTop} stopOpacity="1" />
            <Stop offset="0.6" stopColor={colors.earningsMid} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.earningsBottom} stopOpacity="1" />
          </LinearGradient>
          <RadialGradient id="earnGlow" cx="85%" cy="15%" rx="60%" ry="80%">
            <Stop offset="0" stopColor={colors.accentText} stopOpacity="0.2" />
            <Stop offset="1" stopColor={colors.accentText} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#earnBg)" rx="22" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#earnGlow)" rx="22" />
      </Svg>

      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            {/* B-03: this whole card was capped (eyebrow, amount, caption,
                delta), including the week's dollar amount — the named worst
                offender alongside BottomNav. `inner` has no fixed height
                (padding + gap only), so nothing here needs a ceiling; it
                just grows the card. */}
            <Text style={styles.eyebrow}>
              {i18n.t('dashboard.thisWeek')}
            </Text>
            <Text style={styles.amount}>
              {amount}
            </Text>
            {caption ? (
              <Text style={styles.caption}>
                {caption}
              </Text>
            ) : null}
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
                >
                  {`${deltaUp ? '+' : ''}${deltaPct}% ${i18n.t('dashboard.vsLastWeek')}`}
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

        {onPress ? (
          <View style={styles.affordance} pointerEvents="none">
            <Text style={styles.affordanceText}>{i18n.t('dashboard.seeAnalytics')}</Text>
            <Feather name="chevron-right" size={14} strokeWidth={2} color={colors.accentSoft} />
          </View>
        ) : null}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    overflow: 'hidden',
    backgroundColor: colors.earningsBottom,
  },
  wrapPressed: { opacity: 0.9 },
  affordance: {
    position: 'absolute',
    right: spacing.base + 2,
    bottom: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  affordanceText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: colors.accentSoft,
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
  caption: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.accentSoft,
    marginTop: 4,
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
