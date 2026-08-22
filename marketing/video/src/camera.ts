import {interpolate, Easing} from 'remotion';
import {EASE_ENTRY} from './motion';

/**
 * Pre-made cinematic camera motions.
 *
 * A "camera" here is a CSS transform applied to the scene's stage: the phone
 * and its backdrop move as one rig, so a glide reads as the camera travelling
 * rather than the phone sliding across a static background.
 *
 * All of them run on the MOTION.md entry curve (ease-out cubic) rather than a
 * bespoke one, so a camera settles the way a sheet or a card settles in the
 * app. See the departure note in motion.ts about duration.
 */

export type Camera = {
  translateX: number;
  translateY: number;
  scale: number;
  rotateY: number;
  rotateX: number;
};

export const STILL: Camera = {translateX: 0, translateY: 0, scale: 1, rotateY: 0, rotateX: 0};

export const toTransform = (c: Camera) =>
  `translate3d(${c.translateX}px, ${c.translateY}px, 0) scale(${c.scale}) ` +
  `rotateX(${c.rotateX}deg) rotateY(${c.rotateY}deg)`;

type Span = {frame: number; duration: number; easing?: (n: number) => number};

const ramp = ({frame, duration, easing = EASE_ENTRY}: Span) =>
  interpolate(frame, [0, Math.max(1, duration)], [0, 1], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** Lateral travel. The workhorse: a slow drift that keeps a static screen alive. */
export const glide = (
  span: Span,
  {from = -60, to = 60, axis = 'x'}: {from?: number; to?: number; axis?: 'x' | 'y'} = {},
): Camera => {
  const t = ramp(span);
  const v = from + (to - from) * t;
  return {...STILL, translateX: axis === 'x' ? v : 0, translateY: axis === 'y' ? v : 0};
};

/** Perspective tilt — the phone turns towards the viewer as the shot settles. */
export const tilt = (
  span: Span,
  {fromY = 18, toY = 6, fromX = -6, toX = 0}: {fromY?: number; toY?: number; fromX?: number; toX?: number} = {},
): Camera => {
  const t = ramp(span);
  return {
    ...STILL,
    rotateY: fromY + (toY - fromY) * t,
    rotateX: fromX + (toX - fromX) * t,
  };
};

/** A full-ish orbit for logo moments. Kept shallow — MOTION.md forbids bounce and flash. */
export const rotate = (
  span: Span,
  {degrees = 24}: {degrees?: number} = {},
): Camera => ({...STILL, rotateY: -degrees / 2 + degrees * ramp(span)});

/** Push-in (zoom). `to` above 1 moves the camera towards the subject. */
export const pushIn = (
  span: Span,
  {from = 1, to = 1.12}: {from?: number; to?: number} = {},
): Camera => ({...STILL, scale: from + (to - from) * ramp(span)});

/** Pull-back, for the outro breath after a busy sequence. */
export const pullBack = (span: Span, {from = 1.12, to = 1}: {from?: number; to?: number} = {}): Camera =>
  pushIn(span, {from, to});

/** Compose several moves into one rig transform (glide + tilt + push, etc.). */
export const combine = (...cameras: Camera[]): Camera =>
  cameras.reduce<Camera>(
    (acc, c) => ({
      translateX: acc.translateX + c.translateX,
      translateY: acc.translateY + c.translateY,
      scale: acc.scale * c.scale,
      rotateY: acc.rotateY + c.rotateY,
      rotateX: acc.rotateX + c.rotateX,
    }),
    {...STILL},
  );

export const CAMERA_PRESETS = {glide, tilt, rotate, pushIn, pullBack} as const;
export {Easing};

/**
 * Camera moves as DATA, so a scene's motion can live in a timeline array and be
 * retimed in the Studio without touching a component. `duration` is filled in by
 * the resolver from the Sequence's own length.
 */
export type CameraSpec =
  | {preset: 'still'}
  | {preset: 'glide'; from?: number; to?: number; axis?: 'x' | 'y'}
  | {preset: 'tilt'; fromY?: number; toY?: number; fromX?: number; toX?: number}
  | {preset: 'rotate'; degrees?: number}
  | {preset: 'pushIn'; from?: number; to?: number}
  | {preset: 'pullBack'; from?: number; to?: number}
  | {preset: 'combine'; of: CameraSpec[]};

export const resolveCamera = (spec: CameraSpec, frame: number, duration: number): Camera => {
  const span = {frame, duration};
  switch (spec.preset) {
    case 'still':
      return STILL;
    case 'glide':
      return glide(span, spec);
    case 'tilt':
      return tilt(span, spec);
    case 'rotate':
      return rotate(span, spec);
    case 'pushIn':
      return pushIn(span, spec);
    case 'pullBack':
      return pullBack(span, spec);
    case 'combine':
      return combine(...spec.of.map((s) => resolveCamera(s, frame, duration)));
    default:
      return STILL;
  }
};
