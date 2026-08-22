import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {color, type as T, radius, space} from '../theme';
import {Wordmark} from './Wordmark';
import {fadeIn, slideUp, scaleIn} from '../motion';
import {CTA_COPY, type CtaKey} from '../cta';
import {CITY} from '../captions';

/**
 * The outro CTA.
 *
 * Takes a CtaKey — one of three, from cta.ts — never a string. FACTS section 5:
 * the app is not on the App Store until Oct 1-10 2026, so a "download" CTA is
 * banned, and the enum is what makes it unwriteable rather than merely discouraged.
 *
 * The footer states the launch position plainly. Saying "not on the App Store yet"
 * out loud is not a weakness in a pre-launch reel; it is the thing that makes the
 * waitlist ask make sense.
 */

export const Outro: React.FC<{cta: CtaKey}> = ({cta}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const copy = CTA_COPY[cta];

  const opacity = fadeIn({frame, fps});
  const y = slideUp({frame, fps}, 30);
  const s = scaleIn({frame, fps}, 0.95);

  return (
    <AbsoluteFill style={{background: color.bg, justifyContent: 'center', alignItems: 'center'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(100% 55% at 50% 45%, ${color.accentMuted} 0%, transparent 65%)`,
        }}
      />
      <div style={{opacity, transform: `translateY(${y}px) scale(${s})`, textAlign: 'center', padding: space.xl}}>
        <div style={{marginBottom: space.xl}}>
          <Wordmark size={72} />
        </div>

        {/* Square-ish button, 12px radius — design/tokens.md rule 6. Never a pill. */}
        <div
          style={{
            display: 'inline-block',
            background: color.accentBtn,
            borderRadius: radius.button,
            padding: '28px 48px',
            fontFamily: T.headline.family,
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: -1,
            color: color.textPrimary,
            boxShadow: '0 8px 24px rgba(110,86,247,0.4)',
          }}
        >
          {copy.line}
        </div>

        <div
          style={{
            fontFamily: T.sub.family,
            fontSize: 34,
            color: color.accentText,
            marginTop: space.lg,
          }}
        >
          {copy.sub}
        </div>

        <div
          style={{
            fontFamily: T.label.family,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 2.6,
            textTransform: 'uppercase',
            color: color.textTertiary,
            marginTop: space.xl + space.base,
          }}
        >
          {CITY} · Not on the App Store yet
        </div>
      </div>
    </AbsoluteFill>
  );
};
