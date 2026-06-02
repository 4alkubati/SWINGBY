import { useEffect, useMemo, useState } from 'react'
import api from '@/services/api'
import DataTable from '@/components/DataTable'
import styles from './AuditLogPage.module.css'

/* ── Constants ────────────────────────────────────────────────────────────── */

const PLACEHOLDER_ROWS = [
  { id: 1, timestamp: '2026-05-27T09:14:00Z', actor: 'admin@swingby.com', action: 'suspend_user',      resource_type: 'user',    resource_id: 'usr_001' },
  { id: 2, timestamp: '2026-05-27T08:55:00Z', actor: 'admin@swingby.com', action: 'verify_license',    resource_type: 'business', resource_id: 'biz_012' },
  { id: 3, timestamp: '2026-05-26T17:40:00Z', actor: 'system',            action: 'booking_completed', resource_type: 'booking',  resource_id: 'bkg_089' },
  { id: 4, timestamp: '2026-05-26T15:22:00Z', actor: 'admin@swingby.com', action: 'unsuspend_user',    resource_type: 'user',    resource_id: 'usr_047' },
  { id: 5, timestamp: '2026-05-26T12:01:00Z', actor: 'system',            action: 'payment_released',  resource_type: 'booking',  resource_id: 'bkg_074' },
]

const TIME_RANGE_OPTIONS = [
  { value: 'all',  label: 'All Time'    },
  { value: '24h',  label: 'Last 24h'   },
  { value: '7d',   label: 'Last 7 Days' },
  { value: '30d',  label: 'Last 30 Days' },
]

const ACTION_OPTIONS = [
  { value: 'all',               label: 'All Actions'        },
  { value: 'suspend_user',      label: 'suspend_user'       },
  { value: 'unsuspend_user',    label: 'unsuspend_user'     },
  { value: 'verify_license',    label: 'verify_license'     },
  { value: 'booking_completed', label: 'booking_completed'  },
  { value: 'payment_released',  label: 'payment_released'   },
]

const ACTION_BADGE = {
  suspend_user:      'badge badge-red',
  unsuspend_user:    'badge badge-green',
  verify_license:    'badge badge-blue',
  booking_completed: 'badge badge-orange',
  payment_released:  'badge badge-muted',
}

const SKELETON_ROWS = Array.from({ length: 6 }, (_, i) => i)

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function formatTimestamp(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ts
  }
}

function actionBadgeClass(action) {
  return ACTION_BADGE[action] || 'badge badge-muted'
}

function cutoffForRange(range) {
  if (range === 'all') return null
  const now = Date.now()
  if (range === '24h') return now - 24 * 60 * 60 * 1000
  if (range === '7d')  return now -  7 * 24 * 60 * 60 * 1000
  if (range === '30d') return now - 30 * 24 * 60 * 60 * 1000
  return null
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

function SkeletonRows() {
  return (
    <div className={styles.skeletonBody}>
      {SKELETON_ROWS.map((i) => (
        <div
          key={i}
          className={styles.skeletonRow}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
        </div>
      ))}
    </div>
  )
}

/* ── Event detail drawer ──────────────────────────────────────────────────── */

function EventDrawer({ entry, onClose }) {
  const isOpen = entry !== null

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Audit event details"
      >
        {entry && (
          <>
            {/* Header */}
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleGroup}>
                <h2 className={styles.drawerTitle}>Event Details</h2>
                <span className={styles.drawerSubtitle}>
                  {entry.id ? `#${entry.id}` : 'audit event'}
                </span>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close panel"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className={styles.drawerBody}>
              {/* Structured fields */}
              <div className={styles.detailGrid}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Timestamp</span>
                  <span className={`${styles.detailValue} ${styles.detailValueMono}`}>
                    {formatTimestamp(entry.timestamp || entry.created_at)}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Actor</span>
                  <span className={styles.detailValue}>
                    {entry.actor || entry.admin_email || '—'}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Action</span>
                  <span className={styles.detailValue}>
                    <span className={actionBadgeClass(entry.action || entry.event_type)}>
                      {entry.action || entry.event_type || '—'}
                    </span>
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Resource Type</span>
                  <span className={styles.detailValue}>
                    <span className="badge badge-muted">
                      {entry.resource_type || entry.entity_type || '—'}
                    </span>
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Resource ID</span>
                  <span className={`${styles.detailValue} ${styles.detailValueMono}`}>
                    {entry.resource_id || entry.entity_id || '—'}
                  </span>
                </div>
              </div>

              {/* Raw JSON */}
              <div className={styles.rawSection}>
                <div className={styles.rawSectionTitle}>Raw Event</div>
                <pre className={styles.rawCodeBlock}>
                  <code>{JSON.stringify(entry, null, 2)}</code>
                </pre>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

/* ── Column definitions ───────────────────────────────────────────────────── */

const COLUMNS = [
  {
    key: 'timestamp',
    label: 'Timestamp',
    sortable: true,
    render: (val, row) => (
      <span className={styles.timestampCell}>
        {formatTimestamp(val || row.created_at)}
      </span>
    ),
  },
  {
    key: 'actor',
    label: 'Actor',
    sortable: true,
    render: (val, row) => val || row.admin_email || '—',
  },
  {
    key: 'action',
    label: 'Action',
    sortable: true,
    render: (val, row) => {
      const action = val || row.event_type
      return (
        <span className={actionBadgeClass(action)}>
          {action || '—'}
        </span>
      )
    },
  },
  {
    key: 'resource_type',
    label: 'Resource',
    sortable: true,
    render: (val, row) => (
      <span className="badge badge-muted">
        {val || row.entity_type || '—'}
      </span>
    ),
  },
  {
    key: 'resource_id',
    label: 'Resource ID',
    sortable: false,
    render: (val, row) => (
      <span className={styles.resourceIdCell}>
        {val || row.entity_id || '—'}
      </span>
    ),
  },
]

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function AuditLogPage() {
  const [entries, setEntries]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [isPlaceholder, setIsPlaceholder] = useState(false)
  const [timeRange, setTimeRange]       = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [selectedEntry, setSelectedEntry] = useState(null)

  useEffect(() => {
    api.get('/admin/audit-log')
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.logs ?? []
        setEntries(data)
        setIsPlaceholder(false)
      })
      .catch(() => {
        setEntries(PLACEHOLDER_ROWS)
        setIsPlaceholder(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredEntries = useMemo(() => {
    const cutoff = cutoffForRange(timeRange)
    return entries.filter((entry) => {
      if (cutoff) {
        const ts = new Date(entry.timestamp || entry.created_at).getTime()
        if (isNaN(ts) || ts < cutoff) return false
      }
      if (actionFilter !== 'all') {
        const action = (entry.action || entry.event_type || '').toLowerCase()
        if (action !== actionFilter) return false
      }
      return true
    })
  }, [entries, timeRange, actionFilter])

  return (
    <>
      {/* Page header */}
      <div className={`page-header ${styles.section0}`}>
        <h1>Audit Log</h1>
        <p className={styles.pageHeaderSubtitle}>
          Admin actions and system events.
          {isPlaceholder && (
            <span className={styles.placeholderTag}>placeholder data</span>
          )}
        </p>
      </div>

      {/* Table card */}
      <div className={`${styles.tableCard} ${styles.section1}`}>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>

            {/* Time-range segmented control */}
            <div
              className={styles.segmentGroup}
              role="group"
              aria-label="Filter by time range"
            >
              {TIME_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.segmentBtn} ${timeRange === opt.value ? styles.segmentBtnActive : ''}`}
                  onClick={() => setTimeRange(opt.value)}
                  aria-pressed={timeRange === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Action-type select */}
            <select
              className={styles.actionSelect}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Filter by action type"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.toolbarRight}>
            {!loading && (
              <span className={styles.countPill}>
                <span className={styles.countPillNum}>{filteredEntries.length}</span>
                {' '}of {entries.length} events
              </span>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && <SkeletonRows />}

        {/* Empty state */}
        {!loading && filteredEntries.length === 0 && (
          <div className={styles.stateEmpty}>
            <div className={styles.stateEmptyTitle}>
              {timeRange !== 'all' || actionFilter !== 'all'
                ? 'No events match the current filters.'
                : 'No audit log entries found.'}
            </div>
            {(timeRange !== 'all' || actionFilter !== 'all') && (
              <div className={styles.stateEmptySub}>
                Try a different time range or action type.
              </div>
            )}
          </div>
        )}

        {/* Data table */}
        {!loading && filteredEntries.length > 0 && (
          <DataTable
            columns={COLUMNS}
            data={filteredEntries}
            pageSize={15}
            onRowClick={(row) => setSelectedEntry(row)}
            rowClassName={() => styles.clickableRow}
          />
        )}
      </div>

      {/* Event detail drawer */}
      <EventDrawer
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </>
  )
}
