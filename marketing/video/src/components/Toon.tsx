import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {drawChar, drawBubble, drawArrow, drawPop} from '../toon/toon.mjs';
import {easeOutCubic, TOON_W, TOON_H, type ToonSpec} from '../toon';

/**
 * Draws the cartoon layer on a canvas over the scene.
 *
 * useLayoutEffect, not useEffect: layout effects run before the browser paints,
 * so the canvas is already drawn when Remotion captures the frame. With a plain
 * useEffect the capture can land on the previous frame's drawing, which shows up
 * as a one-frame lag that only appears in the render and never in the Studio.
 *
 * The canvas is sized to the toon coordinate space (1080x1920) and stretched by
 * CSS, so the same coordinates work in the square and wide cuts.
 */
export const Toon: React.FC<{spec: ToonSpec; startAt?: number}> = ({spec, startAt = 0}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const span = Math.max(1, durationInFrames - startAt);
  const p = Math.min(1, Math.max(0, (frame - startAt) / span));

  useLayoutEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, TOON_W, TOON_H);
    if (p <= 0) return;

    // Order matters: the character sits under its own bubble, and the pointing
    // devices (arrow, pop) go on top of both so they read against the UI.
    if (spec.char) drawChar(c, spec.char, p, easeOutCubic);
    if (spec.bubble) {
      drawBubble(
        c,
        {font: '600 46px "Space Grotesk", sans-serif', ...spec.bubble},
        p,
        easeOutCubic,
      );
    }
    if (spec.arrow) drawArrow(c, spec.arrow, p, easeOutCubic);
    if (spec.pop) drawPop(c, spec.pop, p, easeOutCubic, easeOutCubic);
  }, [p, spec]);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <canvas
        ref={ref}
        width={TOON_W}
        height={TOON_H}
        style={{width: '100%', height: '100%'}}
      />
    </AbsoluteFill>
  );
};
