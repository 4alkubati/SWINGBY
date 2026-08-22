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
 * THE WORDMARK. Capital S, two y's. FACTS.md section 0.
 * marketing/social-assets/post.html ships the dead one-y spelling on every
 * frame it renders — that is the specific bug this constant exists to prevent.
 * Never inline the brand name as a string literal anywhere else in this project.
 */
export const WORDMARK = 'Swingbyy' as const;

/** Canvas sizes. reel-9x16 is primary; the other two are derived cuts. */
export const canvas = {
  reel:   {width: 1080, height: 1920},
  square: {width: 1080, height: 1080},
  wide:   {width: 1920, height: 1080},
} as const;

export const FPS = 30;
