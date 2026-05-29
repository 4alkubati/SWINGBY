import { useEffect, useState } from 'react'
import api from '@/services/api'

const KPI_DEFS = [
  { key: 'users',      label: 'Total Users',     fallback: '—', delta: '' },
  { key: 'businesses', label: 'Businesses',       fallback: '—', delta: '' },
  { key: 'bookings',   label: 'Total Bookings',   fallback: '—', delta: '' },
  { key: 'revenue',    label: 'Revenue (AED)',     fallback: '—', delta: '' },
]

export default function DashboardPage() {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Attempt to fetch live stats; fall back to placeholder if endpoint not yet ready
    api.get('/admin/stats')
      .then((res) => setStats(res.data))
      .catch(() => setStats({
        users:      '—',
        businesses: '—',
        bookings:   '—',
        revenue:    '—',
      }))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Platform overview — live numbers once endpoints are ready.</p>
      </div>

      {loading ? (
        <div className="state-loading">Loading stats…</div>
      ) : (
        <div className="kpi-grid">
          {KPI_DEFS.map(({ key, label }) => (
            <div className="kpi-card" key={key}>
              <div className="kpi-label">{label}</div>
              <div className="kpi-value">
                {stats?.[key] ?? '—'}
              </div>
              <div className="kpi-delta">All time</div>
            </div>
          ))}
        </div>
      )}

      <div className="table-wrapper">
        <div className="table-toolbar">
          <span>
            <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>Recent Activity</strong>
          </span>
        </div>
        <div className="state-empty">
          Activity feed will appear here once /admin/stats is live.
        </div>
      </div>
    </>
  )
}
