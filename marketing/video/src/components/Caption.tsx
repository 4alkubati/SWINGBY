import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {color, type as T, radius, space} from '../theme';
import {fadeIn, slideUp, fadeOut} from '../motion';
import {assertCaption, type Caption as CaptionData} from '../captions';

/**
 * Lower-third caption. Muted viewers decide in the first seconds, so this is
 * built for silence: heavy weight, high contrast, a scrim behind it so it stays
 * legible over any screenshot, and never more than two short lines.
 *
 * The `data` prop is a Caption from captions.ts, not a string. There is no way to
 * pass free text — that is what keeps every rendered line FACTS-cited.
 */

export const Caption: React.FC<{
  data: CaptionData;
  /** Frame within the parent Sequence where the exit starts. */
  outAt?: number;
  align?: 'bottom' | 'center';
}> = ({data, outAt, align = 'bottom'}) => {
  const c = assertCaption(data);
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const exitStart = outAt ?? durationInFrames - Math.ceil((180 / 1000) * fps);
  const opacity = Math.min(fadeIn({frame, fps}), fadeOut({frame, fps, start: exitStart}));
  const y = slideUp({frame, fps}, 28);

  return (
    <div
      style={{
        position: 'absolute',
        left: space.xl,
        right: space.xl,
        ...(align === 'bottom' ? {bottom: 210} : {top: '50%'}),
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          background: color.overlayScrim,
          border: `1px solid ${color.border}`,
          borderRadius: radius.card,
          padding: '26px 30px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            fontFamily: T.caption.family,
            fontSize: T.caption.size,
            fontWeight: T.caption.weight,
            letterSpacing: T.caption.letterSpacing,
            lineHeight: T.caption.lineHeight,
            color: color.textPrimary,
            whiteSpace: 'pre-line',
          }}
        >
          {c.text}
        </div>
        {c.sub ? (
          <div
            style={{
              fontFamily: T.sub.family,
              fontSize: T.sub.size,
              fontWeight: T.sub.weight,
              lineHeight: T.sub.lineHeight,
              color: color.textSecondary,
              marginTop: 12,
            }}
          >
            {c.sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};
