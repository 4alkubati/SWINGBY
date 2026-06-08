import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'production' && process.env.SENTRY_AUTH_TOKEN && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ].filter(Boolean),
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5174,
  },
}))
