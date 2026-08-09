// Regression for ERR_USING_RELEASED_SHARED_OBJECT on the business proof-of-work
// screen (25 occurrences in one walkthrough session).
//
// Root cause: the voice-note card is keyed on `proof.voice_note.url` so the
// PLAYER remounts instead of expo-audio releasing its native object under a
// live JS handle (see the comment above the card's render call in
// ProofOfWorkScreen.js). But the RECORDER lived inside that same keyed
// subtree — so the moment a memo finished saving, the url changed, the key
// changed, and the whole card (recorder included) tore down and remounted
// while `useAudioRecorderState`'s 250 ms poller kept reading the just-released
// recorder. The fix hoists the recorder into an outer, unkeyed wrapper
// (VoiceNoteCard) and keys only the player-owning body (VoiceNoteCardBody).
//
// This test drives the real sequence — record, stop, save (url changes) — and
// asserts the recorder hook is never re-invoked by that save, which is what
// "the recorder was torn down by the key change" would look like from the
// mock's point of view.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProofOfWorkScreen from '../ProofOfWorkScreen';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

// Local override of jest.setup.js's global expo-audio mock: this file needs
// call-count visibility on useAudioRecorder/useAudioRecorderState across a
// remount, and a recorder whose `.uri` only appears after `.stop()` (matching
// real expo-audio behaviour, and what stopRecording() in the screen depends
// on).
const mockRecorder = {
  record: jest.fn(),
  stop: jest.fn(() => {
    mockRecorder.uri = 'file:///tmp/recording.m4a';
    mockRecorder.isRecording = false;
    // Real expo-audio flips isRecording in the native state the poller
    // reads too — mirror that so the UI leaves "Recording…" once stopped.
    setMockRecorderState({ isRecording: false });
    return Promise.resolve();
  }),
  prepareToRecordAsync: jest.fn(() => Promise.resolve()),
  isRecording: false,
  uri: null,
};
// The real useAudioRecorderState re-renders its component on every native
// poll tick. A plain static object wouldn't — the component would never see
// `isRecording` flip — so this backs the mock with an external store the
// test can push updates through (setMockRecorderState), same shape as the
// real hook's live behaviour.
let mockRecorderStateValue = { isRecording: false, durationMillis: 3000 };
const mockRecorderStateListeners = new Set();
function setMockRecorderState(patch) {
  mockRecorderStateValue = { ...mockRecorderStateValue, ...patch };
  mockRecorderStateListeners.forEach((listener) => listener());
}

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
  remove: jest.fn(),
  replace: jest.fn(),
};
const mockPlayerStatus = { playing: false, didJustFinish: false, currentTime: 0, isLoaded: true };

// React calls a hook's function body on every re-render regardless of
// whether the calling component is the SAME instance or a freshly mounted
// one — so a plain call-count on the useAudioRecorder mock can't tell "still
// mounted" from "torn down and remounted". A real mount/unmount can: an
// effect with an empty dependency array fires its setup once per mount and
// its cleanup once per unmount, no matter how many times the surrounding
// component re-renders in between. That is the signal this test needs — if
// the recorder is still nested inside the url-keyed subtree, saving a memo
// makes the unmount spy fire before the next mount.
const mockRecorderMountSpy = jest.fn();
const mockRecorderUnmountSpy = jest.fn();

jest.mock('expo-audio', () => {
  const ReactLib = require('react');
  return {
    useAudioRecorder: jest.fn(() => {
      ReactLib.useEffect(() => {
        mockRecorderMountSpy();
        return () => mockRecorderUnmountSpy();
      }, []);
      return mockRecorder;
    }),
    useAudioRecorderState: jest.fn(() =>
      ReactLib.useSyncExternalStore(
        (onStoreChange) => {
          mockRecorderStateListeners.add(onStoreChange);
          return () => mockRecorderStateListeners.delete(onStoreChange);
        },
        () => mockRecorderStateValue,
      ),
    ),
    useAudioPlayer: jest.fn(() => mockPlayer),
    useAudioPlayerStatus: jest.fn(() => mockPlayerStatus),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    requestRecordingPermissionsAsync: jest.fn(() =>
      Promise.resolve({ status: 'granted', granted: true }),
    ),
    RecordingPresets: { HIGH_QUALITY: {} },
    AudioModule: { requestRecordingPermissionsAsync: jest.fn() },
  };
});
import * as ExpoAudio from 'expo-audio';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ProofOfWorkScreen
        navigation={{ goBack: jest.fn() }}
        route={{ params: { bookingId: 'bk-1' } }}
      />
    </SafeAreaProvider>,
  );
}

function proof(overrides = {}) {
  return {
    status: 'in_progress',
    client_photos: [],
    before: [],
    after: [],
    voice_note: null,
    counts: { before: 0, after: 0, before_needed: 2, after_needed: 2, can_submit: false },
    ...overrides,
  };
}

// A synchronous-enough fake XHR so uploadWithProgress() (a raw
// XMLHttpRequest, not the mocked api client) resolves without hitting a real
// network in jsdom.
class FakeXHR {
  constructor() {
    this.upload = {};
  }
  open() {}
  setRequestHeader() {}
  send() {
    this.status = 200;
    this.responseText = JSON.stringify({ url: 'https://cdn.test/voice_1.m4a', path: 'voice/1' });
    Promise.resolve().then(() => this.onload && this.onload());
  }
}

describe('ProofOfWorkScreen voice recorder survives a saved memo', () => {
  let realXHR;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecorder.uri = null;
    mockRecorder.isRecording = false;
    setMockRecorderState({ isRecording: false, durationMillis: 3000 });
    realXHR = global.XMLHttpRequest;
    global.XMLHttpRequest = FakeXHR;
  });

  afterEach(() => {
    global.XMLHttpRequest = realXHR;
  });

  it('does not re-mount the recorder when a saved memo changes the player key', async () => {
    // First load: no memo yet. After the save completes, the screen refetches
    // and the server now has a voice_note — this is the url change that keys
    // the player subtree.
    api.get
      .mockResolvedValueOnce(proof())
      .mockResolvedValue(
        proof({
          voice_note: { url: 'https://cdn.test/voice_1.m4a', path: 'voice/1', duration_seconds: 3 },
        }),
      );
    api.put.mockResolvedValue({});

    const utils = renderScreen();
    // Wait for the loaded screen, not just the fetch being issued — while
    // status is still 'loading' the screen renders a spinner, not
    // VoiceNoteCard, so the recorder hasn't mounted yet.
    const recordBtn = await waitFor(() => utils.getByLabelText('Record a voice note'));

    // The recorder mounts exactly once on first render.
    expect(mockRecorderMountSpy).toHaveBeenCalledTimes(1);
    expect(mockRecorderUnmountSpy).not.toHaveBeenCalled();

    // Start recording, then stop — the screen's stopRecording() reads
    // recorder.uri (set by recorder.stop()) and hands it to onRecorded(),
    // which uploads and PUTs the voice-note row, then refetches.
    await act(async () => {
      fireEvent.press(recordBtn);
    });
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);

    act(() => setMockRecorderState({ isRecording: true }));
    const stopBtn = utils.getByLabelText('Stop recording');
    await act(async () => {
      fireEvent.press(stopBtn);
    });

    // The save round-trip completed: uploaded, PUT the row, refetched.
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/bookings/bk-1/proof/voice-note',
      expect.objectContaining({ url: 'https://cdn.test/voice_1.m4a' }),
    ));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));

    // The url-keyed player body remounted (this is expected and correct —
    // it's the mechanism that avoids NativeSharedObjectNotFoundException on
    // the PLAYER). What must NOT have happened is the recorder being torn
    // down and recreated along with it: if it were still nested inside that
    // keyed subtree, the unmount spy would have fired here, followed by a
    // second mount.
    expect(mockRecorderUnmountSpy).not.toHaveBeenCalled();
    expect(mockRecorderMountSpy).toHaveBeenCalledTimes(1);
    expect(ExpoAudio.useAudioRecorderState).toHaveBeenCalledWith(mockRecorder, 250);

    // And the screen is still readable post-remount — no thrown render error
    // from a released-object read.
    await waitFor(() => expect(utils.getByText('Voice note saved')).toBeTruthy());
  });
});
