import {Config} from '@remotion/cli/config';

// Kira's constraint 2026-08-20: keep this box at ~50% utilisation, 60% only if
// needed. Remotion defaults to every core, which on the laptop means the
// renderer competes with the 36B crew model for the same RAM.
Config.setConcurrency('50%');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
