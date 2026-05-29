/**
 * T88 — Jest configuration for Detox E2E tests
 */

module.exports = {
  testEnvironment: 'detox/runners/jest/streamlineTestRunner',
  testRunner: 'jest-circus/runner',
  testTimeout: 120000,
  testRegex: '.*\\.e2e\\.js$',
  reporters: ['detox/runners/jest/streamlineReporter'],
  verbose: true,
};
