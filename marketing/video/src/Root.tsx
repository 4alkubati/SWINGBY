import React from 'react';
import {Composition} from 'remotion';
import {Reel} from './Reel';
import {canvas, FPS} from './theme';
import {TEMPLATES, totalFrames, type TemplateName} from './timeline';
import {CTA} from './cta';

/**
 * Compositions.
 *
 *   reel-9x16   1080x1920  PRIMARY — the vertical feed cut
 *   square-1x1  1080x1080
 *   wide-16x9   1920x1080
 *
 * Plus one composition per template so each is directly scrubbable and
 * renderable from the Studio sidebar without editing code.
 *
 * The phone is sized off the shorter edge in the square and wide cuts, so the
 * same beats reframe rather than crop. Captions keep their own margins.
 */

const DEFAULT_TEMPLATE: TemplateName = 'cinematic-glide';

export const RemotionRoot: React.FC = () => {
  const main = TEMPLATES[DEFAULT_TEMPLATE](CTA.WAITLIST);

  return (
    <>
      <Composition
        id="reel-9x16"
        component={Reel}
        durationInFrames={totalFrames(main)}
        fps={FPS}
        width={canvas.reel.width}
        height={canvas.reel.height}
        defaultProps={{beats: main}}
      />
      <Composition
        id="square-1x1"
        component={Reel}
        durationInFrames={totalFrames(main)}
        fps={FPS}
        width={canvas.square.width}
        height={canvas.square.height}
        defaultProps={{beats: main}}
      />
      <Composition
        id="wide-16x9"
        component={Reel}
        durationInFrames={totalFrames(main)}
        fps={FPS}
        width={canvas.wide.width}
        height={canvas.wide.height}
        defaultProps={{beats: main}}
      />

      {(Object.keys(TEMPLATES) as TemplateName[]).map((name) => {
        const beats = TEMPLATES[name](
          name === 'quick-cut-feature-tour'
            ? CTA.FOLLOW
            : name === 'single-feature-spotlight'
              ? CTA.EARLY_ACCESS
              : CTA.WAITLIST,
        );
        return (
          <Composition
            key={name}
            id={`tpl-${name}`}
            component={Reel}
            durationInFrames={totalFrames(beats)}
            fps={FPS}
            width={canvas.reel.width}
            height={canvas.reel.height}
            defaultProps={{beats}}
          />
        );
      })}
    </>
  );
};
