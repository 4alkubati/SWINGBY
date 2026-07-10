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
