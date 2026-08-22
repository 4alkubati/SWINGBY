import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {color, type as T, space} from '../theme';
import {fadeIn, slideUp, fadeOut, scaleIn} from '../motion';
import {assertCaption, type Caption as CaptionData, CITY} from '../captions';

/**
 * THE HOOK — the first ~1.5s.
 *
 * A muted viewer decides here, so the problem or the benefit is stated outright,
 * in words, full-frame. No logo-first opening: the wordmark has no equity yet
 * and spending the only second that matters on it is how a reel gets scrolled.
 *
 * The line itself is a Caption from captions.ts and is FACTS-cited like any other.
 */

export const Hook: React.FC<{data: CaptionData; city?: string}> = ({data, city = CITY}) => {
  const c = assertCaption(data);
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const exitStart = durationInFrames - Math.ceil((180 / 1000) * fps);
  const opacity = Math.min(fadeIn({frame, fps}), fadeOut({frame, fps, start: exitStart}));
  const y = slideUp({frame, fps}, 32);
  const s = scaleIn({frame, fps}, 0.96);

  return (
    <AbsoluteFill
      style={{
        background: color.bg,
        justifyContent: 'center',
        padding: space.xl + space.base,
      }}
    >
      {/* The one sanctioned glow moment: a soft accent radial, not glassmorphism. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 60% at 50% 8%, ${color.accentMuted} 0%, transparent 60%)`,
          opacity: 0.85,
        }}
      />
      <div style={{opacity, transform: `translateY(${y}px) scale(${s})`}}>
        <div
          style={{
            fontFamily: T.label.family,
            fontSize: T.label.size,
            fontWeight: T.label.weight,
            letterSpacing: T.label.letterSpacing,
            textTransform: 'uppercase',
            color: color.textSecondary,
            marginBottom: space.lg,
          }}
        >
          {city}
        </div>
        <div
          style={{
            fontFamily: T.hook.family,
            fontSize: T.hook.size,
            fontWeight: T.hook.weight,
            letterSpacing: T.hook.letterSpacing,
            lineHeight: T.hook.lineHeight,
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
              fontSize: 38,
              lineHeight: 1.3,
              color: color.accentText,
              marginTop: space.lg,
            }}
          >
            {c.sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
