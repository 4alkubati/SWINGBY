/* eslint-disable no-undef */
// Native-module mocks for the render harness.
//
// jest-expo already auto-mocks most `expo-*` modules. This file covers the
// community/native packages jsdom can't run: maps, reanimated, gesture-handler,
// async-storage, sentry, places-autocomplete, toast. Each mock is guarded so a
// version bump that moves a mock path can't take the whole suite down — an
// agent extending this file only has to add the one package that broke.

// --- Reanimated 4 + worklets -------------------------------------------------
try {
  jest.mock('react-native-reanimated', () => {
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
  });
} catch (_) {
  // Fallback if the shipped mock path changed: minimal no-op surface.
  jest.mock('react-native-reanimated', () => ({
    __esModule: true,
    default: { View: 'Animated.View', Text: 'Animated.Text', call: () => {} },
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v) => v,
    withSpring: (v) => v,
    Easing: { linear: () => {}, inOut: () => () => {} },
  }));
}
// NOTE: do NOT stub `react-native-worklets`. Reanimated's runtime calls
// `createSerializable` from it during import; an empty stub makes 35 screens
// fail to import with "createSerializable is not a function". The real package
// is transformed fine by the preset — leave it alone.

// --- Gesture handler ---------------------------------------------------------
try {
  require('react-native-gesture-handler/jestSetup');
} catch (_) { /* optional */ }

// --- Async storage -----------------------------------------------------------
try {
  jest.mock(
    '@react-native-async-storage/async-storage',
    () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
  );
} catch (_) { /* optional */ }

// --- Maps (native views can't render in jsdom) -------------------------------
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = (name) => {
    const C = ({ children, ...props }) => React.createElement(View, { ...props, testID: props.testID || name }, children);
    C.displayName = name;
    return C;
  };
  const MapView = Passthrough('MapView');
  return {
    __esModule: true,
    default: MapView,
    Marker: Passthrough('Marker'),
    Callout: Passthrough('Callout'),
    Circle: Passthrough('Circle'),
    Polygon: Passthrough('Polygon'),
    Polyline: Passthrough('Polyline'),
    PROVIDER_GOOGLE: 'google',
  };
});

// --- Google Places autocomplete ---------------------------------------------
jest.mock('react-native-google-places-autocomplete', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    __esModule: true,
    GooglePlacesAutocomplete: (props) => React.createElement(TextInput, { testID: 'places-autocomplete', ...props }),
  };
});

// --- Icon fonts --------------------------------------------------------------
// @expo/vector-icons pulls in expo-font -> expo-asset at import time. Glyphs are
// irrelevant to a render proof, so stub every icon set to a plain View that
// carries its name through props (queryable by testID if a test cares).
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return new Proxy(
    {},
    {
      get: () => (props) => React.createElement(View, { ...props, testID: props?.testID || `icon-${props?.name || ''}` }),
    }
  );
});

// --- Toast -------------------------------------------------------------------
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
  show: jest.fn(),
  hide: jest.fn(),
}));

// --- Sentry ------------------------------------------------------------------
jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  wrap: (c) => c,
  ReactNativeTracing: jest.fn(),
  withScope: (fn) => fn({ setTag: jest.fn(), setContext: jest.fn() }),
}));

// --- Expo modules jest-expo doesn't fully stub -------------------------------
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])),
}));

// `expo-audio` was mocked NOWHERE, and neither proof-of-work screen was in the
// mount sweep — so the voice-memo module had never been exercised by a test at
// all, and the first screen to import it died on `Cannot read properties of
// undefined (reading 'prototype')` at import time.
//
// The player half is shaped so the read-only playback UIs work: a stable object
// with the methods they call, and a status that reports "loaded but not playing".
// `useAudioPlayerStatus` returning a fresh object each render would loop, so the
// status is a module-level constant.
jest.mock('expo-audio', () => {
  const status = {
    playing: false,
    didJustFinish: false,
    currentTime: 0,
    duration: 12,
    isLoaded: true,
  };
  const player = {
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    remove: jest.fn(),
    replace: jest.fn(),
  };
  const recorderState = { isRecording: false, durationMillis: 0 };
  const recorder = {
    record: jest.fn(),
    stop: jest.fn(() => Promise.resolve()),
    prepareToRecordAsync: jest.fn(() => Promise.resolve()),
    uri: null,
  };
  return {
    useAudioPlayer: jest.fn(() => player),
    useAudioPlayerStatus: jest.fn(() => status),
    useAudioRecorder: jest.fn(() => recorder),
    useAudioRecorderState: jest.fn(() => recorderState),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
    requestRecordingPermissionsAsync: jest.fn(() =>
      Promise.resolve({ status: 'granted', granted: true }),
    ),
    RecordingPresets: { HIGH_QUALITY: {} },
    AudioModule: { requestRecordingPermissionsAsync: jest.fn() },
  };
});

// Global, not per-test: `services/liveLocation` imports this, so ANY screen that
// wants the provider's position drags it in. Without a mock here the module is
// untransformed ESM and the importing screen dies with "Jest encountered an
// unexpected token" — which surfaces as the whole suite failing to parse, not as
// anything resembling a location problem. Permissions default to granted;
// LiveLocation.test.js overrides this locally to exercise the denied paths.
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true }),
  ),
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true }),
  ),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
}));

// Silence the noisy RN animation-timer warning under fake DOM.
jest.spyOn(console, 'warn').mockImplementation((msg) => {
  if (typeof msg === 'string' && /useNativeDriver|VirtualizedLists/.test(msg)) return;
  // let everything else through so agents still see real warnings
  process.stderr.write(`console.warn: ${msg}\n`);
});

// react-native-view-shot — native capture, no jsdom equivalent.
//
// `virtual: true` because this mock has to work on a checkout where the package
// has not been installed yet. Without it, adding PhotoAnnotator's import broke
// every suite that renders BookingPhotos (and therefore BookingDetailsScreen)
// with "Cannot find module", which looks like a test failure and is not one.
//
// captureRef resolves a fake file URI so the markup save path can be asserted
// end to end: draw -> capture -> upload -> attach as a NEW photo row.
jest.mock(
  'react-native-view-shot',
  () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
      __esModule: true,
      default: React.forwardRef((props, ref) => {
        React.useImperativeHandle(ref, () => ({}), []);
        return React.createElement(View, props, props.children);
      }),
      captureRef: jest.fn(() => Promise.resolve('file:///tmp/markup-capture.jpg')),
    };
  },
  { virtual: true },
);
