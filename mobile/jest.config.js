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
};
