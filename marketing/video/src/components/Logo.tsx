import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {color, type as T, space} from '../theme';
import {Wordmark} from './Wordmark';
import {fadeIn, fadeOut, scaleIn, springValue} from '../motion';

/**
 * The wordmark card.
 *
 * WORDMARK comes from theme.ts and is never inlined as a literal. FACTS section 0:
 * the name is SwingByy — capital S, two y's. marketing/social-assets/post.html
 * hardcodes the dead one-y spelling on every frame it renders; that is the exact
 * mistake this indirection prevents, and claim_lint fails the build on it.
 *
 * FACTS section 0.1: the logo is NOT broken, do not "fix" it.
 */

export const Logo: React.FC<{sub?: string}> = ({sub}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const exitStart = durationInFrames - Math.ceil((180 / 1000) * fps);
  const opacity = Math.min(fadeIn({frame, fps}), fadeOut({frame, fps, start: exitStart}));
  const s = scaleIn({frame, fps}, 0.94);
  // The dot settles on the MOTION.md interactive spring — the same physics as a
  // press in the app, so the mark feels like the product rather than a title card.
  const dot = springValue({frame, fps}, 0, 1);

  return (
    <AbsoluteFill style={{background: color.bg, justifyContent: 'center', alignItems: 'center'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(90% 52% at 50% 50%, ${color.accentMuted} 0%, transparent 65%)`,
        }}
      />
      <div style={{opacity, transform: `scale(${s})`, textAlign: 'center'}}>
        {/* The lockup carries the brand on its own. The old version set a UI-accent
            dot beside a flat string, which both misspelled the mark (lowercase b)
            and put the wrong purple next to it. */}
        <div style={{display: 'flex', justifyContent: 'center', transform: `scale(${dot})`}}>
          <Wordmark size={T.wordmark.size} />
        </div>
        {sub ? (
          <div
            style={{
              fontFamily: T.label.family,
              fontSize: T.label.size,
              fontWeight: T.label.weight,
              letterSpacing: T.label.letterSpacing,
              textTransform: 'uppercase',
              color: color.textSecondary,
              marginTop: space.lg,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
