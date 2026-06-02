import { useEffect, useState, useCallback } from 'react'
import api from '@/services/api'
import DataTable from '@/components/DataTable'
import styles from './BusinessesPage.module.css'

/* ── Constants ────────────────────────────────────────────────────────────── */

const LICENSE_BADGE = {
  verified: 'badge-green',
  pending:  'badge-orange',
  rejected: 'badge-red',
}

const FILTER_OPTIONS = [
  { value: 'all',      label: 'All'      },
  { value: 'verified', label: 'Verified' },
  { value: 'pending',  label: 'Pending'  },
  { value: 'rejected', label: 'Rejected' },
]

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function licenseKey(biz) {
  return (biz.license_status || 'pending').toLowerCase()
}

function ownerName(biz) {
  return biz.owner_name || biz.owner?.name || '—'
}

function jobsDone(biz) {
  const n = biz.jobs_completed ?? biz.total_jobs
  return n != null ? n : '—'
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */

const SKELETON_ROWS = Array.from({ length: 6 }, (_, i) => i)

function SkeletonRows() {
  return (
    <div className={styles.skeletonBody}>
      {SKELETON_ROWS.map((i) => (
        <div key={i} className={styles.skeletonRow} style={{ animationDelay: `${i * 60}ms` }}>
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

/* ── Sub-components ───────────────────────────────────────────────────────── */

function LicenseBadge({ status }) {
  const key = (status || 'pending').toLowerCase()
  return (
    <span className={`badge ${LICENSE_BADGE[key] || 'badge-muted'}`}>
      {status || 'pending'}
    </span>
  )
}

/* ── Drawer ───────────────────────────────────────────────────────────────── */

function BusinessDrawer({ biz, onClose, onVerifyToggle }) {
  const [busy, setBusy] = useState(false)
  const isOpen = biz !== null

  const handleVerify = useCallback(async () => {
    if (!biz) return
    const shouldVerify = licenseKey(biz) !== 'verified'
    setBusy(true)
    try {
      await api.post(`/admin/businesses/${biz.id}/verify`, { verified: shouldVerify })
      onVerifyToggle(biz.id, shouldVerify ? 'verified' : 'pending')
    } catch (err) {
      // Surface error without blocking the UI; keep drawer open
      const msg = err.response?.data?.detail || 'Action failed. Please try again.'
      alert(msg)
    } finally {
      setBusy(false)
    }
  }, [biz, onVerifyToggle])

  return (
    <>
      {isOpen && (
        <div
          className={styles.backdrop}
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <aside
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        aria-label="Business details"
        role="complementary"
      >
        {biz && (
          <>
            {/* Header */}
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitleGroup}>
                <h2 className={styles.drawerTitle}>{biz.name}</h2>
                <span className={styles.drawerOwner}>Owner: {ownerName(biz)}</span>
              </div>
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close panel"
                type="button"
              >
                {/* X icon via SVG — no emoji */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className={styles.drawerBody}>

              {/* Category + License row */}
              <div className={styles.metaRow}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Category</span>
                  <span className={styles.metaValue}>{biz.category || 'Uncategorized'}</span>
                </div>
                <div className={styles.metaDivider} />
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>License</span>
                  <LicenseBadge status={biz.license_status} />
                </div>
              </div>

              {/* Stats pills */}
              <div className={styles.statsRow}>
                <div className={styles.statPill}>
                  <span className={styles.statPillLabel}>Avg Rating</span>
                  {biz.avg_rating != null ? (
                    <span className={`${styles.statPillValue} ${styles.statPillValueAccent}`}>
                      {Number(biz.avg_rating).toFixed(1)}
                    </span>
                  ) : (
                    <span className={styles.statPillValue} style={{ color: 'var(--color-text-secondary)' }}>—</span>
                  )}
                </div>
                <div className={styles.statPill}>
                  <span className={styles.statPillLabel}>Jobs Done</span>
                  <span className={styles.statPillValue}>{jobsDone(biz)}</span>
                </div>
              </div>

              {/* Services section */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Services</div>
                <div className={styles.drawerPlaceholder}>
                  Service listings will appear here once connected.
                </div>
              </div>

              {/* Employees section */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Employees</div>
                <div className={styles.drawerPlaceholder}>
                  Employee roster will appear here once connected.
                </div>
              </div>

              {/* Reviews section */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Reviews</div>
                <div className={styles.drawerPlaceholder}>
                  No reviews to display yet.
                </div>
              </div>

            </div>

            {/* Footer — verify / revoke */}
            <div className={styles.drawerFooter}>
              {licenseKey(biz) === 'verified' ? (
                <button
                  className={styles.revokeBtn}
                  onClick={handleVerify}
                  disabled={busy}
                  type="button"
                >
                  {busy && <span className={styles.btnSpinner} />}
                  Revoke verification
                </button>
              ) : (
                <button
                  className={styles.verifyBtn}
                  onClick={handleVerify}
                  disabled={busy}
                  type="button"
                >
                  {busy && <span className={styles.btnSpinner} />}
                  Verify business
                </button>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')
  const [selected, setSelected]     = useState(null)

  useEffect(() => {
    api.get('/admin/businesses')
      .then((res) => setBusinesses(Array.isArray(res.data) ? res.data : res.data?.businesses ?? []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load businesses'))
      .finally(() => setLoading(false))
  }, [])

  /* Optimistic update after verify/revoke */
  const handleVerifyToggle = useCallback((id, newStatus) => {
    setBusinesses((prev) =>
      prev.map((b) => b.id === id ? { ...b, license_status: newStatus } : b)
    )
    setSelected((prev) =>
      prev?.id === id ? { ...prev, license_status: newStatus } : prev
    )
  }, [])

  /* Filtered + searched slice */
  const filtered = businesses.filter((biz) => {
    const matchSearch = search.trim() === ''
      || biz.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all'
      || licenseKey(biz) === filter
    return matchSearch && matchFilter
  })

  /* DataTable columns */
  const columns = [
    {
      key: 'name',
      label: 'Business',
      sortable: true,
      render: (val, row) => (
        <div
          className={styles.nameCell}
          onClick={() => setSelected(row)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSelected(row)}
        >
          <span className={styles.nameText}>{val || '—'}</span>
          <svg className={styles.nameArrow} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      ),
    },
    {
      key: 'owner_name',
      label: 'Owner',
      sortable: true,
      render: (_val, row) => ownerName(row),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (val) => val || '—',
    },
    {
      key: 'license_status',
      label: 'License',
      sortable: true,
      render: (val) => <LicenseBadge status={val} />,
    },
    {
      key: 'avg_rating',
      label: 'Rating',
      sortable: true,
      render: (val) =>
        val != null ? (
          <span className={styles.ratingCell}>
            {/* Star SVG — no emoji */}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M6 1l1.39 2.82L10.5 4.24l-2.25 2.19.53 3.1L6 8.1l-2.78 1.43.53-3.1L1.5 4.24l3.11-.42L6 1z"/>
            </svg>
            {Number(val).toFixed(1)}
          </span>
        ) : (
          <span className={styles.ratingMuted}>—</span>
        ),
    },
    {
      key: 'jobs_completed',
      label: 'Jobs',
      sortable: true,
      render: (_val, row) => jobsDone(row),
    },
  ]

  return (
    <>
      {/* Page header */}
      <div className={`page-header ${styles.section0}`}>
        <h1>Businesses</h1>
        <p>All registered businesses on the platform.</p>
      </div>

      {/* Table card */}
      <div className={`${styles.tableCard} ${styles.section1}`}>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {/* Search */}
            <div className={styles.searchWrap}>
              <svg
                className={styles.searchIcon}
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Search by business name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search businesses"
              />
            </div>

            {/* License filter */}
            <div className={styles.filterGroup} role="group" aria-label="Filter by license status">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.filterBtn} ${filter === opt.value ? styles.filterBtnActive : ''}`}
                  onClick={() => setFilter(opt.value)}
                  aria-pressed={filter === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.toolbarRight}>
            {!loading && (
              <span className={styles.countLabel}>
                <span className={styles.countNum}>{filtered.length}</span>
                {' '}of {businesses.length}
              </span>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && <SkeletonRows />}

        {/* Error state */}
        {!loading && error && (
          <div className={styles.errorState}>{error}</div>
        )}

        {/* Empty state — no businesses at all */}
        {!loading && !error && businesses.length === 0 && (
          <div className={styles.stateEmpty}>
            <div className={styles.stateEmptyTitle}>No businesses registered yet</div>
            <div className={styles.stateEmptySub}>
              Businesses will appear here once they sign up on the platform.
            </div>
          </div>
        )}

        {/* Empty state — filter or search yields no results */}
        {!loading && !error && businesses.length > 0 && filtered.length === 0 && (
          <div className={styles.stateEmpty}>
            <div className={styles.stateEmptyTitle}>No businesses match the current filters</div>
            <div className={styles.stateEmptySub}>
              Try a different search term or license status.
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && !error && filtered.length > 0 && (
          <DataTable
            columns={columns}
            data={filtered}
            pageSize={15}
          />
        )}
      </div>

      {/* Detail drawer */}
      <BusinessDrawer
        biz={selected}
        onClose={() => setSelected(null)}
        onVerifyToggle={handleVerifyToggle}
      />
    </>
  )
}
