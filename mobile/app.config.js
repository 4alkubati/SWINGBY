// Dynamic Expo config — extends app.json.
// Injects the Google Maps API key from the environment so the secret never
// lives in a committed file. ONE variable activates every map screen:
//
//   Local dev / prebuild:  GOOGLE_MAPS_API_KEY in mobile/.env
//   EAS builds:            eas env:create --name GOOGLE_MAPS_API_KEY --value <key>
//
// Expo CLI loads mobile/.env before evaluating this file. The key is consumed
// natively (AndroidManifest meta-data + iOS GMSServices) — it is deliberately
// NOT prefixed EXPO_PUBLIC_ so it never gets inlined into the JS bundle.
const mapsKey = process.env.GOOGLE_MAPS_API_KEY || '';

// ── The app must know where its backend is, and it must know at BUILD time ──
//
// EXPO_PUBLIC_API_URL is inlined into the bundle when the build runs. eas.json
// sets SENTRY_DISABLE_AUTO_UPLOAD in all four profiles and this variable in
// none of them, so it comes from the EAS environment — or not at all. Miss it
// and services/api.js used to quietly fall back to http://127.0.0.1:8000: a
// shipped app pointing at the phone's own loopback, every screen showing
// "Network Error", and nothing anywhere saying why. It looks like a broken
// phone, not a broken build.
//
// Failing the BUILD is the only fix that cannot be ignored. A warning in a
// release bundle is written to a console nobody is attached to.
//
// Scoped to release profiles on purpose: `expo start` and any dev-client build
// still work with no variable set, because a developer running the backend on
// localhost is exactly who that fallback is for.
const releaseProfiles = ['preview', 'testflight', 'production'];
const profile = process.env.EAS_BUILD_PROFILE;
if (releaseProfiles.includes(profile) && !process.env.EXPO_PUBLIC_API_URL) {
  throw new Error(
    `EXPO_PUBLIC_API_URL is not set for the "${profile}" build.\n` +
      'The app would ship pointing at http://127.0.0.1:8000 and every request ' +
      'would fail on the device.\n' +
      'Fix: eas env:create --environment ' +
      (profile === 'production' ? 'production' : 'preview') +
      ' --name EXPO_PUBLIC_API_URL --value https://<your-api-host>',
  );
}

// NB: CommonJS `module.exports`, not `export default`. mobile/package.json has
// no "type": "module", so Node parses this file as CommonJS and an ESM export
// is a hard SyntaxError — which made `expo config --json` exit 1 and took down
// every Expo command (config, start, build, eas env:create). Shipped that way
// in 950d4f4 and never executed until 2026-07-20.
module.exports = ({ config }) => ({
  ...config,
  // AUTH lane: register the Apple Sign In config plugin. Its mods are iOS-ONLY
  // (it adds the `com.apple.developer.applesignin` entitlement + sets
  // ios.usesAppleSignIn). It contributes NOTHING to an Android prebuild —
  // expo-apple-authentication has no Android native code and autolinking skips
  // it — so it cannot affect the Android demo build. It stays inert until an
  // iOS build exists AND an Apple Developer account backs the entitlement
  // (see docs/SOCIAL_SIGNIN_SETUP.md). expo-web-browser and expo-crypto need
  // no plugin entry — they are plain autolinked modules.
  // expo-audio's config plugin is what writes RECORD_AUDIO into the
  // AndroidManifest and NSMicrophoneUsageDescription into Info.plist. Without
  // it the module autolinks and still cannot record: Android throws at
  // prepareToRecordAsync() and iOS is rejected at review. The permission string
  // is user-facing — it is the sentence shown in the OS prompt.
  plugins: [
    ...(config.plugins || []),
    'expo-apple-authentication',
    [
      'expo-audio',
      {
        microphonePermission:
          'SwingBy uses the microphone so you can record a short voice note about the work you did.',
      },
    ],
    // M9 — the native Stripe Payment Sheet. This plugin is what makes the
    // in-app sheet buildable at all: on iOS it adds the blank Swift file the
    // Stripe native module needs to link, and on Android it manages the Google
    // Pay manifest meta-data.
    //
    // The props object is REQUIRED. `withStripe` destructures
    // `props.merchantIdentifier` and `props.enableGooglePay` directly, so
    // registering this plugin as the bare string '@stripe/stripe-react-native'
    // (which is what `npx expo install` prints) crashes prebuild with a
    // TypeError on undefined. Always pass an object.
    //
    // merchantIdentifier is Apple Pay ONLY, and it is deliberately EMPTY.
    // A non-empty value writes the `com.apple.developer.in-app-payments`
    // entitlement, which fails iOS provisioning until a merchant ID is actually
    // registered with Apple.
    //
    // NOTE (2026-07-30): an Apple Developer account now exists, so this is no
    // longer blocked on that — but it IS still blocked on registering a merchant
    // ID in the Apple Developer portal AND enabling Apple Pay in Stripe. Leave it
    // empty until both are done; card payments need none of it, and a premature
    // value breaks the build rather than degrading gracefully.
    // Then set STRIPE_MERCHANT_IDENTIFIER (e.g. merchant.com.swingby.app).
    [
      '@stripe/stripe-react-native',
      {
        merchantIdentifier: process.env.STRIPE_MERCHANT_IDENTIFIER || '',
        enableGooglePay: false,
      },
    ],
  ],
  // NB: the two platforms take DIFFERENT shapes here, and getting it wrong
  // fails `expo doctor` in the cloud build (not locally, where doctor isn't
  // run):  Android = android.config.googleMaps.apiKey  (nested)
  //        iOS     = ios.config.googleMapsApiKey       (flat)
  // Using the iOS shape on Android yields:
  //   "Field: android/config - should NOT have additional property
  //    'googleMapsApiKey'"
  android: {
    ...config.android,
    config: {
      ...(config.android && config.android.config),
      googleMaps: {
        ...((config.android && config.android.config && config.android.config.googleMaps) || {}),
        apiKey: mapsKey,
      },
    },
  },
  ios: {
    ...config.ios,
    config: {
      ...(config.ios && config.ios.config),
      googleMapsApiKey: mapsKey,
    },
  },
});
