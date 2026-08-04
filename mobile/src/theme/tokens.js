export const colors = {
  bg: '#07080a',
  surface: '#0F1115',
  surfaceAlt: '#161A21',
  border: '#1F232B',
  textPrimary: '#F4F6FA',
  textSecondary: '#8B92A0',
  textTertiary: '#565D6B',
  accent: '#6E56F7',
  accentMuted: '#2A2247',
  // Lightened accent for foreground text on dark backgrounds; passes AA (6.10:1 on bg).
  accentText: '#8878F9',
  // Darkened accent for button backgrounds with textPrimary label; passes AA (4.56:1).
  accentBtn: '#6D55F6',
  // Softer purple used for eyebrows on purple-tinted surfaces (earnings hero).
  accentSoft: '#B0A4FB',
  // Purple-tinted border used to mark new / highlighted cards.
  borderAccent: 'rgba(136,120,249,0.25)',
  success: '#2EBD85',
  warning: '#F6B23B',
  danger: '#FF5C5C',
  // Map preview gradient stops (top → bottom).
  mapBgTop: '#0D1017',
  mapBgMid: '#101623',
  mapBgBottom: '#0E1320',
  // Solid overlay for glass-lite pill on map (rgba(10,11,14,0.78)).
  overlayScrim: 'rgba(10,11,14,0.78)',
  // Bottom nav bar surface — one step darker than `surface` so the bar reads as
  // chrome, not as a card. Was hardcoded '#0A0B0E' in BottomNav.
  navBg: '#0A0B0E',
  // List dividers sitting directly on `bg` are darker than dividers inside a
  // card (POLISH-TIPS §3 — this distinction is deliberate).
  borderSubtle: '#14171D',
  // The boundary for an INTERACTIVE control sitting directly on `bg`.
  //
  // WCAG 1.4.11 wants 3:1 for the visual information that identifies a control.
  // Measured against `bg` (#07080a): surface 1.06:1, surfaceAlt 1.15:1,
  // border 1.27:1, accentMuted 1.35:1 — every fill token fails, which is why a
  // segmented control drawn with `surface` reads as empty page and gets missed
  // entirely. #565D6B is the most subtle slate in this ramp that clears the bar
  // (3.03:1); anything darker drops under 3:1.
  //
  // Use for the outline of a control the user must SEE to know it exists.
  // For decorative dividers use `border` / `borderSubtle` instead.
  borderStrong: '#565D6B',
  // Skeleton fill + shimmer target (POLISH-TIPS §8: fill surface, shimmer to
  // surfaceAlt). Aliased so skeletons can never drift to near-miss hexes.
  skeletonBase: '#0F1115',
  skeletonShimmer: '#161A21',
  // 14%-alpha tints. Every non-accent colored fill is a tint, never a solid
  // (POLISH-TIPS §2) — these are the canonical four.
  successTint: 'rgba(46,189,133,0.14)',
  warningTint: 'rgba(246,178,59,0.14)',
  dangerTint: 'rgba(255,92,92,0.14)',
  accentTint: 'rgba(110,86,247,0.16)',
  // Purple pulse ring around live dots / map pins.
  accentRing: 'rgba(110,86,247,0.18)',
  successRing: 'rgba(46,189,133,0.16)',
  // Faint grid stroke drawn over the map gradient.
  mapGrid: 'rgba(139,146,160,0.07)',
  // Dashboard earnings hero gradient (135deg) — one of the two sanctioned
  // glow moments (README §10b). Nothing else may use these.
  earningsTop: '#2A2247',
  earningsMid: '#1A1533',
  earningsBottom: '#141127',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

export const radius = {
  chip: 8,
  input: 12,
  button: 12,
  card: 20,
  sheet: 28,
  pill: 999,
  avatar: 999,
};

export const shadows = {
  none: {},
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 12,
  },
  // Purple halo used behind the floating "Post a job" CTA on the client bottom nav.
  accentGlow: {
    shadowColor: '#6E56F7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  // Big drop shadow used by the status card that overlaps the map hero.
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 16,
  },
};

export const motion = {
  entryDuration: 240,
  exitDuration: 180,
  spring: {
    stiffness: 220,
    damping: 22,
  },
};
