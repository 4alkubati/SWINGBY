const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

export function initSentry() {
  if (!SENTRY_DSN) return
}

export function captureException(error, context) {
  if (!SENTRY_DSN) return
  console.error('[Error]', error, context)
}
