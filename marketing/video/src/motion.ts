import {interpolate, spring, Easing} from 'remotion';

/**
 * Motion grammar for video, derived from design/MOTION.md so that marketing
 * motion reads as the same product as the app.
 *
 *   Entry     ease-out cubic, 240ms
 *   Exit      ease-in cubic, 180ms
 *   Transform spring(stiffness 220, damping 22)
 *
 * Every element and camera move in this project goes through a helper here.
 * Nothing calls interpolate() with an ad-hoc easing.
 *
 * ONE DOCUMENTED DEPARTURE. MOTION.md forbids durations over 400ms because a
 * user-initiated UI transition that slow feels sluggish. Camera moves here run
 * for whole seconds. That is not a violation of the rule but a case outside it,
 * the same way MOTION.md already exempts the Live Pulse: a camera glide is
 * ambient continuous motion, not a response to a tap. The 240/180/spring
 * grammar still governs everything that enters, leaves, or is transformed.
 */

export const ENTRY_MS = 240;
export const EXIT_MS = 180;
export const SPRING_CONFIG = {stiffness: 220, damping: 22, mass: 1} as const;

export const EASE_ENTRY = Easing.out(Easing.cubic);
export const EASE_EXIT = Easing.in(Easing.cubic);

/** MOTION.md is written in milliseconds; Remotion counts frames. */
export const ms = (milliseconds: number, fps: number) => (milliseconds / 1000) * fps;

type At = {frame: number; fps: number; start?: number};

/** opacity 0 -> 1 over 240ms, ease-out cubic. */
export const fadeIn = ({frame, fps, start = 0}: At) =>
  interpolate(frame - start, [0, ms(ENTRY_MS, fps)], [0, 1], {
    easing: EASE_ENTRY,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** opacity 1 -> 0 over 180ms, ease-in cubic. `start` is when the exit begins. */
export const fadeOut = ({frame, fps, start = 0}: At) =>
  interpolate(frame - start, [0, ms(EXIT_MS, fps)], [1, 0], {
    easing: EASE_EXIT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** translateY 20 -> 0 with the entry curve. Returns px. */
export const slideUp = ({frame, fps, start = 0}: At, distance = 20) =>
  interpolate(frame - start, [0, ms(ENTRY_MS, fps)], [distance, 0], {
    easing: EASE_ENTRY,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** scale 0.95 -> 1 with the entry curve. */
export const scaleIn = ({frame, fps, start = 0}: At, from = 0.95) =>
  interpolate(frame - start, [0, ms(ENTRY_MS, fps)], [from, 1], {
    easing: EASE_ENTRY,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/**
 * The MOTION.md interactive spring. Overdamped by construction (damping 22
 * against stiffness 220), because MOTION.md forbids bounces.
 */
export const springValue = ({frame, fps, start = 0}: At, from: number, to: number) =>
  from + (to - from) * spring({frame: frame - start, fps, config: SPRING_CONFIG});

/**
 * Combined enter-and-leave opacity for anything that appears then goes away.
 * `outAt` is the frame the exit starts, normally durationInFrames - exit length.
 */
export const inOut = ({frame, fps, start = 0}: At, outAt: number) =>
  Math.min(fadeIn({frame, fps, start}), fadeOut({frame, fps, start: outAt}));

/** Frames an exit needs, for callers sizing a Sequence. */
export const exitFrames = (fps: number) => Math.ceil(ms(EXIT_MS, fps));
