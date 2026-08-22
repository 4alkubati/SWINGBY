/**
 * The cartoon layer, ported from the brain's reelkit (studio/reelkit/toon.mjs).
 *
 * Copied verbatim rather than rewritten. It is already a set of pure functions
 * that take a 2D context and a normalised progress `p`, hold no state, and use
 * no Node APIs — so it runs unchanged in Remotion's Chromium. Rewriting it would
 * have thrown away drawing that is already tuned (the stepped 6fps bob, the
 * squash that resolves without overshoot) for no gain.
 *
 * KEEP IN STEP with reelkit/toon.mjs. If a primitive changes there, copy it
 * here; do not fork the drawing.
 *
 * The one rule it carries over, from FORMAT.md section 4: BOUNCE IS ALLOWED
 * HERE AND NOWHERE ELSE. Product UI stays on the MOTION.md curves at zero
 * overshoot, because the app is under a claims freeze and bouncy product motion
 * reads as a promise. A cartoon bouncing is legibly a joke; a price card
 * bouncing is legibly a lie.
 */
// Types live in toon.d.mts, hand-written so the .mjs stays byte-identical to
// the brain's copy.
export * from './toon.mjs';

/** MOTION.md entry curve, as the `ease` the toon primitives expect. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** The toon layer draws at 1080x1920 and is scaled to the canvas by <Toon>. */
export const TOON_W = 1080;
export const TOON_H = 1920;

export type ToonSpec = {
  char?: {who?: string; pose?: 'slump' | 'shock' | 'grin' | 'point'; at: [number, number]; scale?: number; flip?: boolean};
  bubble?: {at: [number, number]; text: string; tail?: 'bl' | 'br' | 'tl' | 'tr'; maxW?: number; font?: string};
  arrow?: {from: [number, number]; to: [number, number]; curve?: number; width?: number; color?: string};
  pop?: {at: [number, number]; r?: number; rays?: number; color?: string};
};
