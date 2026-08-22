import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {color} from '../theme';
import {PhoneFrame} from './PhoneFrame';
import {Caption} from './Caption';
import {ZoomTo} from './ZoomTo';
import {resolveCamera, type CameraSpec} from '../camera';
import type {Caption as CaptionData} from '../captions';

/**
 * A product beat: phone + camera move + caption, on the brand backdrop.
 *
 * PACING RULE (Kira, 2026-08-20): cut dead time. A scene shorter than MIN_BEAT
 * frames cannot land a caption on a muted viewer, and a scene longer than
 * MAX_BEAT is where a reel loses people. Both are asserted, not commented —
 * a mis-timed Sequence fails the render instead of shipping a slow reel.
 *
 * Never point a scene at a loading spinner or an empty state. The screens
 * manifest tags those `usable: false` and collect-screens.mjs refuses to write
 * them as a scene's primary capture.
 */

export const MIN_BEAT = 45; // 1.5s at 30fps
export const MAX_BEAT = 210; // 7s at 30fps

export type SceneProps = {
  screen?: string;
  startFrom?: number;
  placeholder: string;
  caption?: CaptionData;
  camera?: CameraSpec;
  /** Push in on a UI target, e.g. the live-status card. */
  zoom?: {target: {x: number; y: number}; scale?: number; start?: number; ring?: boolean};
  phoneHeight?: number;
};

export const Scene: React.FC<SceneProps> = ({
  screen,
  startFrom,
  placeholder,
  caption,
  camera = {preset: 'still'},
  zoom,
  phoneHeight,
}) => {
  const {durationInFrames} = useVideoConfig();
  const frame = useCurrentFrame();

  if (durationInFrames < MIN_BEAT) {
    throw new Error(
      `Scene "${placeholder}" is ${durationInFrames} frames — under the ${MIN_BEAT}-frame ` +
        `floor. A muted viewer cannot read a caption that fast. Retime it in the Studio timeline.`,
    );
  }
  if (durationInFrames > MAX_BEAT) {
    throw new Error(
      `Scene "${placeholder}" is ${durationInFrames} frames — over the ${MAX_BEAT}-frame ` +
        `ceiling. That is dead time; trim it in the Studio timeline.`,
    );
  }

  const stage = (
    <PhoneFrame
      screen={screen}
      startFrom={startFrom}
      placeholder={placeholder}
      camera={resolveCamera(camera, frame, durationInFrames)}
      height={phoneHeight}
    />
  );

  return (
    <AbsoluteFill style={{background: color.bg}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(85% 45% at 50% 0%, ${color.accentMuted} 0%, transparent 62%)`,
          opacity: 0.7,
        }}
      />
      {zoom ? (
        <ZoomTo target={zoom.target} scale={zoom.scale} start={zoom.start} ring={zoom.ring}>
          {stage}
        </ZoomTo>
      ) : (
        stage
      )}
      {caption ? <Caption data={caption} /> : null}
    </AbsoluteFill>
  );
};
