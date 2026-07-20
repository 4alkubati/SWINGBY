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

// NB: CommonJS `module.exports`, not `export default`. mobile/package.json has
// no "type": "module", so Node parses this file as CommonJS and an ESM export
// is a hard SyntaxError — which made `expo config --json` exit 1 and took down
// every Expo command (config, start, build, eas env:create). Shipped that way
// in 950d4f4 and never executed until 2026-07-20.
module.exports = ({ config }) => ({
  ...config,
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
