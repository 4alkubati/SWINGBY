/**
 * T88 — Detox configuration for SwingBy mobile app
 *
 * Configures device and emulator targets for E2E testing.
 *
 * NOTE: This is a scaffold. Device paths and simulator configs are placeholders.
 * Actual paths depend on your local Xcode/Android setup.
 *
 * To run E2E tests:
 *   detox build-ios --configuration ios.sim.debug
 *   detox test e2e --configuration ios.sim.debug --cleanup
 */

module.exports = {
  testRunner: 'jest',
  apps: {
    ios: {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/SwingBy.app',
      build: 'xcodebuild -workspace ios/SwingBy.xcworkspace -scheme SwingBy -configuration Release -derivedDataPath ios/build -arch x86_64 -sdk iphonesimulator -development-team TEAM_ID',
    },
    android: {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..',
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: {
        type: 'simulator',
        device: {
          type: 'iPhone 15',
        },
      },
      app: 'ios',
    },
    'ios.sim.release': {
      device: {
        type: 'simulator',
        device: {
          type: 'iPhone 15',
        },
      },
      app: 'ios',
    },
    'android.emu.debug': {
      device: {
        type: 'android.emulator',
        device: {
          avdName: 'Pixel_4_API_30',
        },
      },
      app: 'android',
    },
  },
  testRunner: 'jest',
};
