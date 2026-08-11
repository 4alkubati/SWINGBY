import { Key } from '@phosphor-icons/react'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import styles from './Dashboard.module.css'

// F066 fix (2026-08-11): this page used to be entirely client-side fake — a
// "Create" button minted a `swb_live_...` string with `crypto.randomUUID()`
// and displayed it as a real API key, with security copy claiming a 60
// req/min rate limit that doesn't exist anywhere in the backend. Nothing was
// ever created, nothing was ever revocable, and a refresh silently discarded
// the "key" a business owner might have already put in a config file.
//
// No `/api-keys` route, table, or migration exists in this repo (confirmed:
// `grep -rn "api-keys\|api_keys" backend/app/` returns nothing) — this needs
// real backend work (a keys table, hashed-at-rest storage, and the actual
// rate limiting the old copy claimed), not a frontend fix. Per the same rule
// applied to the admin Businesses page (F040): don't invent a route, make the
// UI honest instead. BLOCKED on backend — see report.
export default function ApiKeys() {
  return (
    <div style={{ maxWidth: '680px' }}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>API keys</h1>
          <p className={styles.pageSubtitle}>Use API keys to authenticate requests to the SwingBy API</p>
        </div>
      </div>

      <Alert type="info">API access is not available yet. This page will let you create and manage keys once it ships.</Alert>

      <div style={{ marginTop: 'var(--space-xl)' }}>
        <EmptyState
          icon={<Key size={48} />}
          title="Coming soon"
          description="Programmatic API access for your business is on the roadmap. Check back later."
        />
      </div>
    </div>
  )
}
