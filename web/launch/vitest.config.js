import { defineConfig } from 'vitest/config'

// SB-0060 — this app's `test` script was `echo "No tests configured yet"`,
// which exits 0. CI ran it and reported a green "Test" step for a suite that
// did not exist. A stub that passes is worse than a missing step: the workflow
// looks gated.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
