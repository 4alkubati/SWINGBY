/**
 * Types for the ported toon.mjs. Hand-written because the source is kept
 * verbatim from the brain's reelkit so the two do not fork — see index.ts.
 *
 * Every primitive takes the 2D context, its own options, a normalised progress
 * `p` (0..1 through its beat) and an easing function. Nothing holds state, which
 * is what lets the same call be sampled several times per frame for a shutter.
 */
type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
type Ease = (t: number) => number;

export declare const ACCENT: string;
export declare const ACCENT_DEEP: string;
export declare const INK: string;
export declare const DIM: string;
export declare const SKIN: string;
export declare const HAIR: string;

export declare function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void;
export declare function bounce(p: number, cycles?: number, damp?: number): number;

export declare function drawArrow(
  c: Ctx,
  o: {from: Pt; to: Pt; curve?: number; width?: number; color?: string},
  p: number,
  ease: Ease,
): void;

export declare function drawPop(
  c: Ctx,
  o: {at: Pt; r?: number; rays?: number; color?: string},
  p: number,
  ease: Ease,
  accel: Ease,
): void;

export declare function drawBubble(
  c: Ctx,
  o: {at: Pt; text: string; tail?: 'bl' | 'br' | 'tl' | 'tr'; maxW?: number; font?: string; pad?: number},
  p: number,
  ease: Ease,
): void;

export declare function drawChar(
  c: Ctx,
  o: {who?: string; pose?: 'slump' | 'shock' | 'grin' | 'point'; at: Pt; scale?: number; flip?: boolean},
  p: number,
  ease: Ease,
): void;
