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

export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android && config.android.config),
      googleMapsApiKey: mapsKey,
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
