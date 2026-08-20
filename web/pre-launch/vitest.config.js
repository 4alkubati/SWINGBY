import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// SB-0060 — no web app contained a single test file, so every `npm run test
// --if-present` step in CI silently did nothing while reporting success. This
// is the deployed app (swingbyy.com), so it is the one that gets a real gate
// first.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
})
