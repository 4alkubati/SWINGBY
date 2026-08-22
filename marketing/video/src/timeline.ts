import {CAPTIONS} from './captions';
import {CTA, type CtaKey} from './cta';
import type {CameraSpec} from './camera';
import type {Caption as CaptionData} from './captions';
import type {ToonSpec} from './toon';

/**
 * THE TIMELINE, as data.
 *
 * Each entry becomes one <Sequence> in <Reel>, which is what makes Remotion
 * Studio's timeline usable: every scene shows as its own bar you can click to
 * jump to, and drag by the edge to retime. Because the timeline is an array and
 * not JSX, a template is just a different array — see TEMPLATES below.
 *
 * Durations are in frames at 30fps. Scene enforces a 45-frame floor and a
 * 210-frame ceiling (see components/Scene.tsx) so dead time fails the render.
 */

export type Beat =
  | {kind: 'hook'; id: string; durationInFrames: number; caption: CaptionData; toon?: ToonSpec}
  | {kind: 'logo'; id: string; durationInFrames: number; sub?: string}
  | {kind: 'outro'; id: string; durationInFrames: number; cta: CtaKey}
  | {
      kind: 'scene';
      id: string;
      durationInFrames: number;
      /** Filename under public/screens — a still, or a .mov/.mp4 screen recording. */
      screen?: string;
      /** Seconds into a recording to start. Ignored for stills. */
      startFrom?: number;
      placeholder: string;
      caption?: CaptionData;
      camera?: CameraSpec;
      zoom?: {target: {x: number; y: number}; scale?: number; start?: number; ring?: boolean};
      phoneHeight?: number;
    };

/** The scene variant, narrowed — so a template can spread one and override `zoom`. */
export type SceneBeat = Extract<Beat, {kind: 'scene'}>;

const S = (n: number) => Math.round(n * 30);

/**
 * THE FIVE PRODUCT BEATS. Screens are bound by filename here and resolved
 * against public/screens; a missing file falls back to the beat's own
 * placeholder, so the whole reel composes and scrubs before any capture exists.
 */
export const BEAT = {
  home: (): SceneBeat => ({
    kind: 'scene',
    id: 'home',
    durationInFrames: S(3.4),
    screen: 'client-home.png',
    placeholder: 'Client Home',
    caption: CAPTIONS.post,
    // A slow lateral drift keeps a static screenshot alive without saying anything.
    camera: {preset: 'combine', of: [{preset: 'tilt', fromY: 16, toY: 5}, {preset: 'glide', from: -34, to: 26}]},
  }),

  details: (): SceneBeat => ({
    kind: 'scene',
    id: 'details',
    durationInFrames: S(3.6),
    screen: 'job-details.png',
    placeholder: 'Job Details',
    caption: CAPTIONS.privacy,
    camera: {preset: 'combine', of: [{preset: 'tilt', fromY: -12, toY: -3}, {preset: 'pushIn', from: 1, to: 1.06}]},
  }),

  quotes: (): SceneBeat => ({
    kind: 'scene',
    id: 'quotes',
    durationInFrames: S(3.4),
    screen: 'quotes.png',
    placeholder: 'Quotes',
    caption: CAPTIONS.quotes,
    camera: {preset: 'combine', of: [{preset: 'tilt', fromY: 14, toY: 4}, {preset: 'glide', from: 30, to: -24}]},
  }),

  confirm: (): SceneBeat => ({
    kind: 'scene',
    id: 'confirm',
    durationInFrames: S(4.0),
    screen: 'active-booking.png',
    placeholder: 'Active Booking',
    caption: CAPTIONS.status,
    camera: {preset: 'tilt', fromY: 10, toY: 2},
    // The live-status stepper is a small chip on a tall screen; push in on it or
    // it is a smudge at feed size. Progress only — never described as tracking.
    zoom: {target: {x: 0.5, y: 0.3}, scale: 1.45, start: S(1.2), ring: true},
  }),

  business: (): SceneBeat => ({
    kind: 'scene',
    id: 'business',
    durationInFrames: S(3.4),
    screen: 'business-dashboard.png',
    placeholder: 'Business Dashboard',
    caption: CAPTIONS.quotes,
    camera: {preset: 'combine', of: [{preset: 'tilt', fromY: -14, toY: -4}, {preset: 'pushIn', from: 1.04, to: 1}]},
  }),
} as const;

export const HOOK_BEAT = (): Beat => ({
  kind: 'hook',
  id: 'hook',
  durationInFrames: S(2.4),
  caption: CAPTIONS.hook,
  // Noor, slumped, bottom-right — reacting to the six voicemails. Bounce is
  // allowed on the cartoon and nowhere else (FORMAT.md section 4).
  toon: {char: {who: 'noor', pose: 'slump', at: [800, 1620], scale: 0.72}},
});

export const LOGO_BEAT = (sub?: string): Beat => ({
  kind: 'logo',
  id: 'logo',
  durationInFrames: S(1.2),
  sub,
});

export const OUTRO_BEAT = (cta: CtaKey = CTA.WAITLIST): Beat => ({
  kind: 'outro',
  id: 'outro',
  durationInFrames: S(2.6),
  cta,
});

/**
 * TEMPLATES — pre-configured scene sequences.
 *
 * `cinematic-glide` is the default reel and the one Kira's brief describes,
 * with ONE deliberate change: it opens on the Hook rather than the wordmark.
 * A muted viewer decides in the first second and a half, and the wordmark has no
 * equity to trade on yet (FACTS section 5 — not launched). `logo-bookend` is the
 * literal Logo -> ... -> Logo order if you want it; both are one line apart.
 */
export const TEMPLATES = {
  'cinematic-glide': (cta: CtaKey = CTA.WAITLIST): Beat[] => [
    HOOK_BEAT(),
    BEAT.home(),
    BEAT.details(),
    BEAT.quotes(),
    BEAT.confirm(),
    OUTRO_BEAT(cta),
  ],

  'logo-bookend': (cta: CtaKey = CTA.WAITLIST): Beat[] => [
    LOGO_BEAT(),
    BEAT.home(),
    BEAT.details(),
    BEAT.quotes(),
    BEAT.confirm(),
    OUTRO_BEAT(cta),
  ],

  /** Fast feature tour — shorter beats, more of them, no zoom dwell. */
  'quick-cut-feature-tour': (cta: CtaKey = CTA.FOLLOW): Beat[] => [
    HOOK_BEAT(),
    {...BEAT.home(), durationInFrames: S(2.0)},
    {...BEAT.details(), durationInFrames: S(2.0)},
    {...BEAT.quotes(), durationInFrames: S(2.0)},
    {...BEAT.confirm(), durationInFrames: S(2.2), zoom: undefined},
    {...BEAT.business(), durationInFrames: S(2.0)},
    OUTRO_BEAT(cta),
  ],

  /** One feature, room to breathe — the pre-acceptance privacy fact. */
  'single-feature-spotlight': (cta: CtaKey = CTA.EARLY_ACCESS): Beat[] => [
    HOOK_BEAT(),
    {
      ...BEAT.details(),
      durationInFrames: S(5.0),
      zoom: {target: {x: 0.5, y: 0.42}, scale: 1.6, start: S(2.0), ring: true},
    },
    {...BEAT.quotes(), durationInFrames: S(4.0)},
    OUTRO_BEAT(cta),
  ],
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export const totalFrames = (beats: Beat[]) =>
  beats.reduce((n, b) => n + b.durationInFrames, 0);
