// Web stub for expo-audio — WEB BUNDLE ONLY.
//
// Recording and playback are native. The hooks below return inert-but-correctly
// SHAPED objects so screens that call them still render on web and can be
// click-tested for layout, copy and navigation — the things the server can
// actually check. Recording itself must be tested on a device.
//
// Permission deliberately resolves to DENIED rather than granted: a stub that
// claims permission would let a web walkthrough believe the mic flow works.
import { useMemo } from 'react';

export const RecordingPresets = {
  HIGH_QUALITY: {},
  LOW_QUALITY: {},
};

export async function requestRecordingPermissionsAsync() {
  return { granted: false, status: 'denied', canAskAgain: false };
}

export async function getRecordingPermissionsAsync() {
  return { granted: false, status: 'denied', canAskAgain: false };
}

export async function setAudioModeAsync() {}

export function useAudioRecorder() {
  return useMemo(
    () => ({
      uri: null,
      isRecording: false,
      prepareToRecordAsync: async () => {},
      record: () => {},
      stop: async () => {},
      pause: () => {},
    }),
    [],
  );
}

export function useAudioRecorderState() {
  return { isRecording: false, durationMillis: 0, metering: undefined };
}

export function useAudioPlayer() {
  return useMemo(
    () => ({
      playing: false,
      play: () => {},
      pause: () => {},
      seekTo: () => {},
      remove: () => {},
      replace: () => {},
    }),
    [],
  );
}

export function useAudioPlayerStatus() {
  return { playing: false, currentTime: 0, duration: 0, didJustFinish: false };
}
