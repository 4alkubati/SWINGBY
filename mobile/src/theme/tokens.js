export const colors = {
  bg: '#07080a',
  surface: '#0F1115',
  surfaceAlt: '#161A21',
  border: '#1F232B',
  textPrimary: '#F4F6FA',
  textSecondary: '#8B92A0',
  accent: '#6E56F7',
  accentMuted: '#2A2247',
  // Lightened accent for foreground text on dark backgrounds; passes AA (6.10:1 on bg).
  accentText: '#8878F9',
  // Darkened accent for button backgrounds with textPrimary label; passes AA (4.56:1).
  accentBtn: '#6D55F6',
  success: '#2EBD85',
  warning: '#F6B23B',
  danger: '#FF5C5C',
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
};

export const motion = {
  entryDuration: 240,
  exitDuration: 180,
  spring: {
    stiffness: 220,
    damping: 22,
  },
};
