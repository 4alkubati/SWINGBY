import { StyleSheet } from 'react-native';

export const typeScale = StyleSheet.create({
  display1: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1,
  },
  display2: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  display3: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h1: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  // POLISH-TIPS §1: "No font-weight 400 headings." h2 was SpaceGrotesk_400
  // (the only 400-weight heading in the scale) — every screen title using it
  // read a weight lighter than the system.
  h2: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  smallMedium: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  // ── Additive variants (Jet × Pulse) ───────────────────────────────────────
  // Screen hero — "Hey Ali." (README §1). Tracking scales with size per §1.
  hero: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
  },
  // "Arriving in 12 min" (README §2) — the 27px step between display1 and display2.
  display1b: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: -1,
  },
  // Money. Always Space Grotesk 700 + tabular numerals so columns of prices
  // line up (POLISH-TIPS §1 + §8). Colour is applied by the caller (success).
  money: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  moneyLarge: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  // Eyebrow over a hero number on a purple-tinted surface ("THIS WEEK").
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  // Standard list-row label — 14.5px/500-ish, the density used across every
  // settings/menu block in the mocks.
  row: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    lineHeight: 20,
  },
});
