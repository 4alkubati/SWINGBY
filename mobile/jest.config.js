// Render harness for the D6.4 pre-spend verification sweep.
//
// Goal: let agents PROVE a screen/component actually renders on a fresh build
// of `main` — not just that the code looks right. Uses the jest-expo preset
// (Expo SDK 54 / RN 0.81 / React 19) with @testing-library/react-native.
//
// Run:  npm test                 (whole suite)
//       npm test StatusBadge     (one file / pattern)
//       npm run test:ci          (CI: no watch, serial, coverage-safe)
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // transformIgnorePatterns is inherited from jest-expo. Its default negative
  // lookahead already prefix-matches `react-native*`, `expo*`, `@react-native*`
  // and `@expo*`, so every community package in this tree gets babel-transformed.
  // Do NOT override it — a hand-rolled pattern dropped `expo-modules-core` and
  // broke the whole preset (it ships untranspiled `.ts`).
  // Screen files live under src/. Match *.test.js and __tests__ folders.
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(test).js'],
  // Native/asset imports that jsdom can't parse resolve to a stub.
  moduleNameMapper: {
    '\\.(png|jpg|jpeg|gif|webp|svg|ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
  },
  clearMocks: true,

  // Jest's default is 5000 ms, and on a loaded machine that is not a timeout —
  // it is a coin toss. 2026-07-30: a full run reported 8 failures across 6
  // suites, every one of them "Exceeded timeout of 5000 ms" with no assertion
  // mismatch anywhere. Re-run in isolation, the same suites passed 23/23. The
  // box was sitting at load ~8 with several agents on it, and a single suite
  // that takes 34 s wall-clock cannot fit its tests into 5 s slices when it is
  // getting a fraction of a core.
  //
  // That is worse than a slow suite: a red run that means nothing trains you to
  // ignore red runs, and the walkthrough defects this repo keeps finding by
  // hand are exactly the kind a trusted suite is supposed to catch. 30 s is
  // long enough that contention cannot manufacture a failure, and short enough
  // that a genuinely hung test still ends the run instead of stalling it.
  //
  // If a test needs more than 30 s of REAL work, that test is the problem.
  testTimeout: 30000,
};
