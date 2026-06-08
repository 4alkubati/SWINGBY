import * as Sentry from '@sentry/react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Strip PII from breadcrumbs and extra data
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }
      return event
    },
  })
}

export { Sentry }
