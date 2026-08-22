import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {color, radius} from '../theme';
import {EASE_ENTRY} from '../motion';

/**
 * ZoomTo — push in on a small UI target so it does not get lost.
 *
 * A status chip or a button is ~40px tall on a screenshot that is already scaled
 * down inside a phone frame inside a 1080-wide canvas. At feed size it is a smudge.
 * This pushes the camera in on it and, optionally, rings it.
 *
 * `target` is normalised to the CHILD's box: {x: 0.5, y: 0.5} is dead centre,
 * {x: 0.5, y: 0.24} is the status card near the top. Using fractions rather than
 * pixels means a re-capture at a different device size does not move the target.
 */

export const ZoomTo: React.FC<{
  target: {x: number; y: number};
  /** Final zoom factor. 1.6-2.2 is the useful range for a chip. */
  scale?: number;
  /** Frames the push takes. Slow is cinematic; under ~20 reads as a snap. */
  duration?: number;
  /** Frame the push begins. */
  start?: number;
  /** Draw a ring around the target once the push settles. */
  ring?: boolean;
  children: React.ReactNode;
}> = ({target, scale = 1.8, duration = 30, start = 0, ring = false, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const t = interpolate(frame - start, [0, duration], [0, 1], {
    easing: EASE_ENTRY,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s = 1 + (scale - 1) * t;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `scale(${s})`,
          transformOrigin: `${target.x * 100}% ${target.y * 100}%`,
        }}
      >
        {children}
        {ring ? <TargetRing target={target} progress={t} fps={fps} frame={frame - start} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * The ring is drawn INSIDE the zoomed layer and its radius is divided by the
 * zoom, so it stays a constant on-screen thickness instead of fattening as the
 * camera pushes in.
 */
const TargetRing: React.FC<{
  target: {x: number; y: number};
  progress: number;
  fps: number;
  frame: number;
}> = ({target, progress}) => {
  const opacity = interpolate(progress, [0.55, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: `${target.x * 100}%`,
        top: `${target.y * 100}%`,
        width: 190,
        height: 84,
        marginLeft: -95,
        marginTop: -42,
        border: `3px solid ${color.accent}`,
        borderRadius: radius.button,
        boxShadow: `0 0 0 6px ${color.accentMuted}`,
        opacity,
      }}
    />
  );
};
