// ScreenHeader — the one back/title/trailing bar for every pushed screen.
//
// design/SPEC-screen-header.md. `headerShown: false` stays on every navigator
// (this component IS the header, drawn in-screen, not a native replacement) —
// every navigator already draws its own bottom nav / chrome, and a native
// header would be a second, inconsistent chrome system on top of that one.
//
// Why this exists: before this component, 45 screens each hand-drew their own
// back button — 5 icon variants, 4 title styles, 5 hitSlop values (one as low
// as 6px on an ~18px glyph, well under the 44pt minimum both platforms write
// into their own guidelines). Three screens drew no back control at all; on
// iOS the only way out was the edge-swipe gesture. This component is the
// single place that gets it right so no screen can reinvent it wrong again.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

// The 44x44 guarantee does NOT come from hitSlop math (spec §7) — hitSlop
// expands the tappable area around whatever the glyph's rendered box happens
// to be, and a Feather glyph's actual bounding box isn't a stable size to
// build arithmetic on. That's exactly how the app ended up with five
// different hitSlop values, each somebody's guess at compensating for a
// different icon size. Instead the Pressable itself is fixed at 44x44,
// independent of the icon inside it — change the icon's size and the tap
// target does not move.
export const HEADER_TAP_TARGET = 44;

export default function ScreenHeader({
  title,
  onBack,
  variant = 'push',
  trailingIcon,
  onTrailingPress,
  trailingAccessibilityLabel,
  testID,
}) {
  const insets = useSafeAreaInsets();

  if (__DEV__ && trailingIcon && !trailingAccessibilityLabel) {
    // eslint-disable-next-line no-console
    console.warn(
      `ScreenHeader: trailingIcon="${trailingIcon}" was passed without a ` +
        'trailingAccessibilityLabel — an icon-only button with no label is ' +
        'exactly the a11y gap this component exists to close.'
    );
  }

  const isModal = variant === 'modal';
  const backIcon = isModal ? 'x' : 'arrow-left';
  const backLabel = isModal ? 'Close' : 'Back';

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.sm },
      ]}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        style={styles.backTarget}
      >
        <Feather name={backIcon} size={20} color={colors.textSecondary} accessible={false} />
      </Pressable>

      <Text
        variant="h1"
        style={styles.title}
        numberOfLines={1}
        ellipsizeMode="tail"
        accessibilityRole="header"
      >
        {title}
      </Text>

      {!!trailingIcon && (
        <Pressable
          onPress={onTrailingPress}
          accessibilityRole="button"
          accessibilityLabel={trailingAccessibilityLabel}
          style={styles.trailingTarget}
        >
          <Feather name={trailingIcon} size={20} color={colors.textPrimary} accessible={false} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.base,
    // minHeight, never height — a fixed height is exactly what clips a title
    // that grows at large accessibility text sizes (spec §5, §8).
    minHeight: HEADER_TAP_TARGET + spacing.sm * 2,
  },
  backTarget: {
    width: HEADER_TAP_TARGET,
    height: HEADER_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    // Pulls the glyph optically back to the screen's left content edge, so it
    // lines up with the cards below it instead of sitting visibly indented by
    // its own padding.
    marginLeft: -spacing.sm,
  },
  trailingTarget: {
    width: HEADER_TAP_TARGET,
    height: HEADER_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  title: {
    flex: 1,
    marginLeft: spacing.sm,
    // typeScale.h1 hardcodes lineHeight: 26 against a fontSize that scales
    // with the OS accessibility text setting. RN scales fontSize but NOT a
    // fixed lineHeight, so at Android's 2.0x setting a ~40px-tall glyph would
    // be asked to fit inside an un-scaled 26px line box and clip its
    // ascenders/descenders. Overriding to undefined lets RN fall back to the
    // font's natural metrics instead. Deliberately NOT fixed in typography.js
    // itself — every other h1 in the app has the same latent bug, and fixing
    // the token globally is a wider blast radius than this component should
    // carry (flagged separately for design-agent / a follow-up ticket).
    lineHeight: undefined,
    // No maxFontSizeMultiplier — a title is primary, must-read text, exactly
    // what the CAPPED_VARIANTS sweep in Text.js was protecting, not capping.
  },
});
