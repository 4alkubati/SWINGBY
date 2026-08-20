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
    // SB-0070 — `true` emits .map files WITH the full original source
    // embedded, and the whole dist/ directory is uploaded to Cloudflare Pages
    // verbatim, so every component, comment and TODO was publicly fetchable.
    //
    // 'hidden' still GENERATES the maps (so they can be uploaded to Sentry for
    // readable stack traces) but omits the //# sourceMappingURL comment, so
    // browsers and crawlers do not go looking for them. If the maps are not
    // being uploaded anywhere, set this to false outright — the only reason to
    // build them at all is a symbolicator that consumes them.
    sourcemap: "hidden",
  },
  server: {
    port: 5174,
  },
}))
