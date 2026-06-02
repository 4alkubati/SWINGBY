// T66 — Screen transition presets for react-navigation
// Uses native stack transitions — no shared-element library needed.
import { colors, motion } from '../theme/tokens';

export const fadeTransition = {
  animation: 'fade',
  config: {
    duration: motion.entryDuration,
  },
};

export const slideFromRight = {
  animation: 'slide_from_right',
  config: {
    duration: motion.entryDuration,
  },
};

export const slideFromBottom = {
  animation: 'slide_from_bottom',
  config: {
    duration: motion.entryDuration,
  },
};

export const defaultScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.bg },
  animation: 'slide_from_right',
};

export const modalScreenOptions = {
  headerShown: false,
  presentation: 'modal',
  contentStyle: { backgroundColor: colors.bg },
  animation: 'slide_from_bottom',
};
