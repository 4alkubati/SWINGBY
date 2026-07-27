// Metro config — exists for ONE reason: make `--platform web` build.
//
// Being able to run this app in a headless browser on the server is what lets
// defects get caught before they reach a phone. On 2026-07-26 four screens
// shipped fully tested and unreachable, plus a red-box crash and copy naming
// the wrong flow — all of it visible in thirty seconds of clicking, none of it
// visible to a test suite.
//
// The only blocker was that a handful of native-only packages have no web
// implementation and hard-fail the web bundle. They are aliased to stubs BELOW
// A `platform === 'web'` CHECK, so iOS and Android resolve the real packages
// and the shipped app is byte-identical to before this file existed.
//
// Anything stubbed here genuinely cannot be tested on the server and must be
// checked on a device: maps, the Stripe Payment Sheet, audio recording and
// biometrics.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// package name -> web-only replacement
const WEB_STUBS = {
  'react-native-maps': path.resolve(__dirname, 'web-stubs/react-native-maps.js'),
  '@stripe/stripe-react-native': path.resolve(__dirname, 'web-stubs/stripe-react-native.js'),
  'expo-audio': path.resolve(__dirname, 'web-stubs/expo-audio.js'),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Match the package itself AND its deep imports ("react-native-maps/lib/...").
    for (const [pkg, stub] of Object.entries(WEB_STUBS)) {
      if (moduleName === pkg || moduleName.startsWith(`${pkg}/`)) {
        return { type: 'sourceFile', filePath: stub };
      }
    }
  }
  // Hand back to Metro's own resolver for every other case, including all of
  // iOS and Android. Never reimplement resolution here.
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
