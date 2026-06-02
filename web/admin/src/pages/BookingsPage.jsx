import { useEffect, useMemo, useState } from 'react'
import api from '@/services/api'
import DataTable from '@/components/DataTable'
import styles from './BookingsPage.module.css'

/* ── Constants ──────────────────────────────────────────────────────────── */

const STATUS_BADGE = {
  confirmed:    'badge-blue',
  'on the way': 'badge-orange',
  in_progress:  'badge-orange',
  done:         'badge-green',
  completed:    'badge-green',
  cancelled:    'badge-red',
}

const STATUS_FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'confirmed',   label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
]

/* ── Helpers ────────────────────────────────────────────────────────────── */

function formatAmount(amount) {
  if (amount == null) return '—'
  return 'AED ' + Number(amount).toLocaleString()
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getStatusKey(status) {
  return (status || '').toLowerCase().replace(/ /g, '_')
}

function isCompleted(booking) {
  const sk = getStatusKey(booking.status)
  return sk === 'completed' || sk === 'done'
}

/* ── Skeleton ───────────────────────────────────────────────────────────── */

function SkeletonRows() {
  return (
    <div className={styles.skeletonBody}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonCell} />
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

/* ── Booking Drawer ─────────────────────────────────────────────────────── */

function BookingDrawer({ booking, onClose, onForceComplete, completing }) {
  const open = booking !== null

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const sk = booking ? getStatusKey(booking.status) : ''
  const badgeClass = STATUS_BADGE[sk] || 'badge-muted'
  const clientName = booking
    ? (booking.client_name || booking.client?.name || '—')
    : ''
  const businessName = booking
    ? (booking.business_name || booking.business?.name || '—')
    : ''
  const amount = booking
    ? formatAmount(booking.amount ?? booking.quoted_price)
    : ''
  const done = booking ? isCompleted(booking) : false

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${open ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
        aria-label="Booking detail"
        role="complementary"
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Booking Detail</span>
          <button
            className={styles.drawerClose}
            onClick={onClose}
            aria-label="Close drawer"
          >
            &times;
          </button>
        </div>

        {booking && (
          <>
            <div className={styles.drawerBody}>
              {/* Identity */}
              <div className={styles.drawerIdentity}>
                <div className={styles.identityIcon} aria-hidden="true">
                  {clientName.charAt(0) || 'B'}
                </div>
                <div className={styles.identityMain}>
                  <div className={styles.drawerBookingId}>#{booking.id}</div>
                  <div className={styles.drawerClientName}>{clientName}</div>
                </div>
              </div>

              {/* Detail grid */}
              <div className={styles.detailGrid}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Status</span>
                  <span className={`badge ${badgeClass}`}>
                    {booking.status || 'confirmed'}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Business</span>
                  <span className={styles.detailValue}>{businessName}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Amount</span>
                  <span className={styles.detailValueAccent}>{amount}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Booking ID</span>
                  <span className={`${styles.detailValue} ${styles.monoValue}`}>
                    {booking.id}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Completed At</span>
                  <span className={styles.detailValue}>
                    {formatDate(booking.completed_at)}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Created At</span>
                  <span className={styles.detailValue}>
                    {formatDate(booking.created_at || booking.booking_date)}
                  </span>
                </div>
              </div>

              {/* Timeline section */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionHeader}>Booking Timeline</div>
                <div className={styles.drawerSectionBody}>
                  Timeline details available when booking events endpoint is live.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={styles.drawerFooter}>
              {!done && (
                <button
                  className={styles.forceCompleteBtn}
                  onClick={() => onForceComplete(booking.id)}
                  disabled={completing === booking.id}
                >
                  {completing === booking.id ? 'Completing…' : 'Force Complete'}
                </button>
              )}
              {done && (
                <span className="badge badge-green">Completed</span>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  )
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function BookingsPage() {
  const [bookings, setBookings]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('all')
  const [selected, setSelected]   = useState(null)   // booking row in drawer
  const [completing, setCompleting] = useState(null)  // id being force-completed

  /* Fetch */
  useEffect(() => {
    api.get('/admin/bookings')
      .then((res) => setBookings(Array.isArray(res.data) ? res.data : res.data?.bookings ?? []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load bookings'))
      .finally(() => setLoading(false))
  }, [])

  /* Derived filtered data */
  const filtered = useMemo(() => {
    let rows = bookings
    if (statusFilter !== 'all') {
      rows = rows.filter((b) => {
        const sk = getStatusKey(b.status)
        if (statusFilter === 'in_progress') return sk === 'in_progress' || sk === 'on_the_way'
        if (statusFilter === 'completed')   return sk === 'completed' || sk === 'done'
        return sk === statusFilter
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((b) => {
        const client   = (b.client_name || b.client?.name || '').toLowerCase()
        const business = (b.business_name || b.business?.name || '').toLowerCase()
        return client.includes(q) || business.includes(q)
      })
    }
    return rows
  }, [bookings, statusFilter, search])

  /* Force-complete handler */
  async function handleForceComplete(id) {
    setCompleting(id)
    try {
      await api.post(`/admin/bookings/${id}/force-complete`)
      // Optimistic update
      const now = new Date().toISOString()
      setBookings((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, status: 'completed', completed_at: now } : b
        )
      )
      // Keep drawer open with updated data
      if (selected?.id === id) {
        setSelected((prev) => ({ ...prev, status: 'completed', completed_at: now }))
      }
    } catch (err) {
      // Surface error without clobbering the page
      console.error('Force-complete failed:', err)
    } finally {
      setCompleting(null)
    }
  }

  /* Table columns */
  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (val) => (
        <span style={{ fontFamily: 'Courier New, monospace', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {val}
        </span>
      ),
    },
    {
      key: 'client_name',
      label: 'Client',
      sortable: true,
      render: (_val, row) => row.client_name || row.client?.name || '—',
    },
    {
      key: 'business_name',
      label: 'Business',
      sortable: true,
      render: (_val, row) => row.business_name || row.business?.name || '—',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => {
        const sk = getStatusKey(val)
        return (
          <span className={`badge ${STATUS_BADGE[sk] || 'badge-muted'}`}>
            {val || 'confirmed'}
          </span>
        )
      },
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (_val, row) => (
        <span className={styles.amountCell}>
          {formatAmount(row.amount ?? row.quoted_price)}
        </span>
      ),
    },
    {
      key: 'completed_at',
      label: 'Completed',
      sortable: true,
      render: (val) =>
        val
          ? <span className="badge badge-green">Yes</span>
          : <span className="badge badge-muted">No</span>,
    },
    {
      key: '_actions',
      label: '',
      sortable: false,
      render: (_val, row) => {
        if (isCompleted(row)) return null
        return (
          <button
            className={styles.actionBtn}
            disabled={completing === row.id}
            onClick={(e) => {
              e.stopPropagation()
              handleForceComplete(row.id)
            }}
          >
            {completing === row.id ? 'Completing…' : 'Force Complete'}
          </button>
        )
      },
    },
  ]

  return (
    <>
      {/* Page header */}
      <div className={`page-header ${styles.pageHeader}`}>
        <h1>Bookings</h1>
        <p>All bookings across the platform.</p>
      </div>

      {/* Table card */}
      <div className={styles.card}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          {/* Search */}
          <div className={styles.toolbarLeft}>
            <div className={styles.searchWrap}>
              <svg
                className={styles.searchIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Search by client or business name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search bookings"
              />
            </div>
          </div>

          {/* Status filter */}
          <div className={styles.toolbarRight}>
            <div className={styles.filterGroup} role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`${styles.filterBtn} ${statusFilter === f.value ? styles.filterBtnActive : ''}`}
                  onClick={() => setStatus(f.value)}
                  aria-pressed={statusFilter === f.value}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {!loading && (
              <span className={styles.count}>
                {filtered.length} {filtered.length === 1 ? 'booking' : 'bookings'}
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && <SkeletonRows />}

        {/* Error */}
        {!loading && error && (
          <div className={styles.stateError}>
            <div className={styles.stateErrorTitle}>Unable to load bookings</div>
            <div className={styles.stateErrorSub}>{error}</div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className={styles.stateEmpty}>
            <div className={styles.stateEmptyTitle}>
              {bookings.length === 0 ? 'No bookings found' : 'No results match your filters'}
            </div>
            {bookings.length > 0 && (
              <div>Try adjusting your search or status filter.</div>
            )}
          </div>
        )}

        {/* DataTable */}
        {!loading && !error && filtered.length > 0 && (
          <DataTable
            columns={columns}
            data={filtered}
            pageSize={15}
            onRowClick={(row) => setSelected(row)}
            rowClassName={() => styles.clickableRow}
          />
        )}
      </div>

      {/* Booking detail drawer */}
      <BookingDrawer
        booking={selected}
        onClose={() => setSelected(null)}
        onForceComplete={handleForceComplete}
        completing={completing}
      />
    </>
  )
}
