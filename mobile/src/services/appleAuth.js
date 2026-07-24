// appleAuth.js — DEFAULT (non-iOS) resolution of the Apple sign-in module.
//
// Metro resolves `./appleAuth` to `appleAuth.ios.js` on iOS and to THIS file on
// Android and web. That is deliberate and load-bearing: it guarantees that
// `expo-apple-authentication` (an iOS-only native module) and any Apple code
// path are physically absent from the Android bundle. The Android build cannot
// be destabilised by a module it never imports.
//
// Everything here is inert. `isAppleAuthSupported()` returns false, so the UI
// never renders the Apple button off iOS, and `signInWithApple()` throws if it
// is somehow called anyway.

export function isAppleAuthSupportedPlatform() {
  return false;
}

// On iOS the real module probes the device (Apple sign-in needs iOS 13+ and a
// signed-in Apple ID). Off iOS there is nothing to probe.
export async function isAppleAuthAvailable() {
  return false;
}

export async function signInWithApple() {
  throw new Error('Apple sign-in is only available on iOS.');
}
