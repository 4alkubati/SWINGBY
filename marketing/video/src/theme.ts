/**
 * Brand tokens for the video engine.
 *
 * MIRRORED FROM design/tokens.md — that file is the single source of truth for
 * the product. This is a copy because Remotion cannot import a markdown table,
 * and a copy that drifts is worse than no copy at all. If you change a value
 * here, change it there in the same commit, and vice versa.
 *
 * Jet x Pulse rules that this file exists to enforce (design/tokens.md):
 *   - accent purple is for CTAs, active states and live indicators ONLY.
 *     Everything else is neutral. Sparingly is a rule, not a preference.
 *   - money is always `success` green.
 *   - Space Grotesk 700 for headings and numerals; Inter for body.
 *   - cards are surface + 1px border + radius; buttons are square-ish, never pills.
 *   - ZERO emoji. Feather icons only.
 */

export const color = {
  bg: '#07080a',
  surface: '#0F1115',
  surfaceAlt: '#161A21',
  border: '#1F232B',
  textPrimary: '#F4F6FA',
  textSecondary: '#8B92A0',
  textTertiary: '#565D6B',
  accent: '#6E56F7',
  accentMuted: '#2A2247',
  accentText: '#8878F9',
  accentBtn: '#6D55F6',
  accentSoft: '#B0A4FB',
  borderAccent: 'rgba(136,120,249,0.25)',
  success: '#2EBD85',
  warning: '#F6B23B',
  danger: '#FF5C5C',
  overlayScrim: 'rgba(10,11,14,0.78)',
} as const;

export const space = {
  xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
} as const;

/** design/tokens.md calls for 12px on buttons/inputs; 20px on cards. */
export const radius = {
  chip: 8, input: 12, button: 12, card: 20, sheet: 28, pill: 999,
} as const;

export const shadow = {
  subtle: '0 4px 8px rgba(0,0,0,0.16)',
  modal: '0 8px 24px rgba(0,0,0,0.32)',
  accentGlow: '0 8px 24px rgba(110,86,247,0.4)',
  card: '0 12px 40px rgba(0,0,0,0.5)',
} as const;

export const font = {
  heading: '"Space Grotesk", system-ui, sans-serif',
  body: '"Inter", system-ui, sans-serif',
} as const;

/**
 * Video type scale. Deliberately much larger than the app's — a 1080x1920 reel
 * is watched at thumbnail size on a phone in a feed, and design/tokens.md's
 * 40px display1 is illegible there. The RATIOS and weights are the app's; the
 * absolute sizes are scaled for video.
 */
export const type = {
  hook:     {family: font.heading, size: 92,  weight: 700, letterSpacing: -3, lineHeight: 1.05},
  headline: {family: font.heading, size: 72,  weight: 700, letterSpacing: -2.4, lineHeight: 1.08},
  caption:  {family: font.heading, size: 56,  weight: 700, letterSpacing: -1.6, lineHeight: 1.14},
  sub:      {family: font.body,    size: 34,  weight: 400, letterSpacing: 0, lineHeight: 1.35},
  label:    {family: font.body,    size: 24,  weight: 600, letterSpacing: 3.2, lineHeight: 1.2},
  wordmark: {family: font.heading, size: 96,  weight: 700, letterSpacing: -3.5, lineHeight: 1},
} as const;

/**
 * THE WORDMARK: `SwingByy` — capital S, **capital B**, two y's.
 *
 * FACTS.md section 0, corrected 2026-08-08 ("the B is capital"). Lowercase-b
 * `SwingByy` is a BANNED spelling, and it is the one this project shipped in
 * every rendered frame until 2026-08-22 — claim_lint did not catch it because
 * its wordmark rule only looked for the dead one-y `SwingBy`. Both are now
 * caught.
 *
 * Use WORDMARK for prose and alt text. To DRAW it, use <Wordmark> — the mark is
 * three spans with an overlap, not a string (see below and components/Wordmark).
 *
 * The domain and handles stay lowercase (`swingbyy.com`, `@swingbyy`). They are
 * addresses, not the wordmark, and section 0 exempts them explicitly.
 */
export const WORDMARK = 'SwingByy' as const;

/**
 * The mark, per design/handoff-logo/README.md — turn 4b, the approved direction.
 *
 * Three spans, and the OVERLAPPING PAIR IS THE MARK: the trailing snow `y` sits
 * back over the purple `y` so the two nearly merge while the purple tail still
 * reads underneath. Setting that trailing y in purple, or writing `Byy` as one
 * span, destroys it — that was the documented 2026-08-08 error, which also
 * produced a flattened icon and a graphic arguing the real logo was broken.
 *
 * Do not redraw, re-kern, un-overlap or "clean up" the mark. If it looks wrong
 * at small size, that is the design (FACTS section 0.1). The handoff also says
 * to REBUILD the lockup in the target environment rather than import a PNG,
 * which is why this is spans and CSS rather than an <Img>.
 *
 * Proportions are from the 112px reference and scale with font size:
 *   letter-spacing  -5px/112px  = -0.0446em
 *   overlap        -30px/112px  = -0.268em  (applied to the last glyph)
 */
export const MARK = {
  swing: 'Swing',
  by: 'By',
  y: 'y',
  letterSpacingEm: -0.0446,
  overlapEm: -0.268,
} as const;

/**
 * Logo Pulse — the wordmark and icon tile ONLY.
 * Distinct from `color.accent` (#6E56F7), the UI accent used for CTAs and live
 * dots. FACTS section 0.1: two different purples, never substitute one for the
 * other, and the UI accent never appears in the logo.
 */
export const LOGO_PULSE = '#8878F9' as const;
export const LOGO_SNOW = '#F4F6FA' as const;

/** Canvas sizes. reel-9x16 is primary; the other two are derived cuts. */
export const canvas = {
  reel:   {width: 1080, height: 1920},
  square: {width: 1080, height: 1080},
  wide:   {width: 1920, height: 1080},
} as const;

export const FPS = 30;
