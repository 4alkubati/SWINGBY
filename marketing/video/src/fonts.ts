import {loadFont as loadSpaceGrotesk} from '@remotion/google-fonts/SpaceGrotesk';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';

/**
 * design/tokens.md: Space Grotesk 700 for headings and numerals, Inter for body.
 *
 * Loaded through @remotion/google-fonts rather than a <link>, because Remotion's
 * headless Chromium renders frames before a network font would arrive and the
 * first frames would silently fall back to system sans. The waitUntilDone()
 * promise is what makes that deterministic.
 */
const grotesk = loadSpaceGrotesk('normal', {weights: ['700']});
const inter = loadInter('normal', {weights: ['400', '600']});

export const fontsReady = Promise.all([grotesk.waitUntilDone(), inter.waitUntilDone()]);

/** Sanity: these must match the families named in theme.ts. */
export const FONT_FAMILIES = {
  heading: grotesk.fontFamily,
  body: inter.fontFamily,
};
