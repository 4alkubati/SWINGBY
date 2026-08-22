import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {color, radius, font} from '../theme';
import {toTransform, type Camera, STILL} from '../camera';
import {hasScreen} from '../screens/available';

/**
 * The tilted 3D phone. Drop a screenshot (or a screen-recording frame) on it and
 * the camera rig moves it.
 *
 * IMPLEMENTATION: CSS 3D. It is fast, it renders deterministically under
 * Remotion's headless Chromium, and it honours the MOTION.md curves because the
 * transform is just numbers from camera.ts.
 *
 * UPGRADE PATH TO @remotion/three, when a photoreal glide is wanted:
 *   1. npm i @remotion/three three @react-three/fiber
 *   2. Replace the <div> stack below with a <ThreeCanvas>, a rounded-box phone
 *      mesh, and a <Img> texture via useVideoTexture/useTexture on the screen face.
 *   3. Drive the mesh rotation from the SAME Camera object this component already
 *      takes, so scenes and templates need no changes.
 *   4. Keep this file as the CSS fallback — three raises render cost per frame,
 *      and the box that renders these is shared.
 * The seam is deliberate: everything above the Camera type stays identical.
 */

export type PhoneFrameProps = {
  /** Path under public/screens, e.g. "client-home.png". Omit for the placeholder. */
  screen?: string;
  /** Label drawn on the placeholder when `screen` is missing. */
  placeholder: string;
  camera?: Camera;
  /** Phone height in px on a 1080x1920 canvas. */
  height?: number;
  /** Extra opacity for cross-fades. */
  opacity?: number;
};

const BEZEL = 18;

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  screen,
  placeholder,
  camera = STILL,
  height = 1450,
  opacity = 1,
}) => {
  // iPhone-ish 19.5:9 aspect. The screen inside the bezel keeps the app's own
  // 20px card radius scaled up, so the device reads as the product, not a stock mock.
  const width = Math.round((height * 9) / 19.5);

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', perspective: 2400}}>
      <div
        style={{
          width,
          height,
          opacity,
          transform: toTransform(camera),
          transformStyle: 'preserve-3d',
          borderRadius: 56,
          padding: BEZEL,
          background: 'linear-gradient(160deg, #23262E 0%, #0C0D11 55%, #1A1D24 100%)',
          boxShadow:
            '0 60px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06) inset',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 40,
            overflow: 'hidden',
            background: color.bg,
            position: 'relative',
          }}
        >
          {/* hasScreen(), not `screen`: a filename that has not been captured yet
              would otherwise render a 404 as a black screen — see screens/available.ts. */}
          {hasScreen(screen) ? (
            <Img
              src={staticFile(`screens/${screen}`)}
              style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top'}}
            />
          ) : (
            <ScreenPlaceholder label={placeholder} />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Every scene has its own placeholder, so the whole reel composes and scrubs in
 * Remotion Studio before a single real capture exists. Replacing a placeholder is
 * then a one-line change in the manifest, not a re-edit.
 */
export const ScreenPlaceholder: React.FC<{label: string}> = ({label}) => (
  <AbsoluteFill
    style={{
      background: `repeating-linear-gradient(135deg, ${color.surface} 0 28px, ${color.surfaceAlt} 28px 56px)`,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    }}
  >
    <div
      style={{
        border: `2px dashed ${color.borderAccent}`,
        borderRadius: radius.card,
        padding: '32px 28px',
        textAlign: 'center',
        background: color.overlayScrim,
      }}
    >
      <div
        style={{
          fontFamily: font.body,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: color.accentText,
          marginBottom: 10,
        }}
      >
        Placeholder
      </div>
      <div style={{fontFamily: font.heading, fontSize: 34, fontWeight: 700, color: color.textPrimary}}>
        {label}
      </div>
      <div style={{fontFamily: font.body, fontSize: 17, color: color.textSecondary, marginTop: 10}}>
        npm run collect
      </div>
    </div>
  </AbsoluteFill>
);
