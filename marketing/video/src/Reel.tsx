import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {color} from './theme';
import {Scene} from './components/Scene';
import {Hook} from './components/Hook';
import {Logo} from './components/Logo';
import {Outro} from './components/Outro';
import type {Beat} from './timeline';
import './fonts';

/**
 * THE ORCHESTRA — every beat is its own <Sequence>, composed into one reel.
 *
 * One Sequence per beat is not a stylistic choice: it is what gives Remotion
 * Studio a timeline you can actually edit. Each bar is clickable (jump to it) and
 * draggable by the edge (retime it). Collapsing beats into a single component
 * would render the same video and take the editing surface away.
 */

export const Reel: React.FC<{beats: Beat[]}> = ({beats}) => {
  let from = 0;
  return (
    <AbsoluteFill style={{background: color.bg}}>
      {beats.map((beat) => {
        const start = from;
        from += beat.durationInFrames;
        return (
          <Sequence
            key={beat.id}
            from={start}
            durationInFrames={beat.durationInFrames}
            name={`${beat.kind}:${beat.id}`}
          >
            <BeatView beat={beat} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const BeatView: React.FC<{beat: Beat}> = ({beat}) => {
  switch (beat.kind) {
    case 'hook':
      return <Hook data={beat.caption} toon={beat.toon} />;
    case 'logo':
      return <Logo sub={beat.sub} />;
    case 'outro':
      return <Outro cta={beat.cta} />;
    case 'scene':
      return (
        <Scene
          screen={beat.screen}
          startFrom={beat.startFrom}
          placeholder={beat.placeholder}
          caption={beat.caption}
          camera={beat.camera}
          zoom={beat.zoom}
          phoneHeight={beat.phoneHeight}
        />
      );
    default:
      return null;
  }
};
