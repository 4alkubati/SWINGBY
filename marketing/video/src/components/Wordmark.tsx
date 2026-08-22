import React from 'react';
import {MARK, LOGO_PULSE, LOGO_SNOW, font} from '../theme';

/**
 * The SwingByy lockup, rebuilt from design/handoff-logo/README.md (turn 4b).
 *
 * Rebuilt rather than imported: the handoff explicitly says to recreate the
 * lockup in the target environment, not to ship a PNG of it. That also means
 * this scales cleanly to any video size instead of resampling a raster.
 *
 * `tone` picks the tile treatment from the handoff:
 *   'jet'   — on the dark background: Swing snow, By pulse, trailing y snow.
 *   'pulse' — on a purple tile: Swing and By go JET, because purple-on-purple
 *             is invisible; the trailing y stays snow so the overlap still reads.
 */
export const Wordmark: React.FC<{
  size: number;
  tone?: 'jet' | 'pulse';
  style?: React.CSSProperties;
}> = ({size, tone = 'jet', style}) => {
  const base = tone === 'pulse' ? '#07080A' : LOGO_SNOW;
  const by = tone === 'pulse' ? '#07080A' : LOGO_PULSE;

  return (
    <span
      style={{
        fontFamily: font.heading,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: MARK.letterSpacingEm * size,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        display: 'inline-block',
        ...style,
      }}
    >
      <span style={{color: base}}>{MARK.swing}</span>
      <span style={{color: by}}>{MARK.by}</span>
      {/* The overlap. This negative margin IS the mark — do not remove it. */}
      <span style={{color: LOGO_SNOW, marginLeft: MARK.overlapEm * size, display: 'inline-block'}}>
        {MARK.y}
      </span>
    </span>
  );
};
