import { useEffect, useState } from 'react'
import api from '@/services/api'
import s from './DashboardPage.module.css'

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString()
}

function fmtCad(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusBadge(status) {
  const colors = {
    confirmed: '#2d7af6', in_progress: '#f59e0b',
    completed: '#16a34a', cancelled: '#dc2626',
  }
  const c = colors[status] || '#6b7280'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: c, background: `${c}18`,
      borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>{status?.replace('_', ' ')}</span>
  )
}

function roleBadge(role) {
  const colors = {
    client: '#7c3aed', business_owner: '#2d7af6',
    employee: '#059669', admin: '#dc2626',
  }
  const c = colors[role] || '#6b7280'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: c, background: `${c}18`,
      borderRadius: 4, padding: '2px 7px',
    }}>{role?.replace('_', ' ')}</span>
  )
}

/* ─── KPI Card ────────────────────────────────────────────────────────────── */

function KpiCard({ label, value, sub }) {
  return (
    <div className={s.kpiCard}>
      <div className={s.kpiLabel}>{label}</div>
      <div className={s.kpiValue}>{value}</div>
      {sub && <div className={s.kpiDelta}>{sub}</div>}
    </div>
  )
}

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <>
      <div className={`${s.skeletonGrid} ${s.section0}`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div className={s.skeletonCard} key={i}>
            <div className={`${s.skeletonLine} ${s.skeletonLabel}`} />
            <div className={`${s.skeletonLine} ${s.skeletonValue}`} />
            <div className={`${s.skeletonLine} ${s.skeletonDelta}`} />
          </div>
        ))}
      </div>
      <div className={`${s.skeletonChartCard} ${s.section1}`}>
        <div className={s.skeletonChartTitle} />
        <div className={s.skeletonChartBody} />
      </div>
      <div className={`${s.skeletonActivityCard} ${s.section2}`}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={s.skeletonActivityRow} />)}
      </div>
    </>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const [users, setUsers]       = useState(null)
  const [bookings, setBookings] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/admin/users').then(r => r.data).catch(() => []),
      api.get('/admin/bookings').then(r => r.data).catch(() => []),
    ]).then(([u, b]) => {
      setUsers(Array.isArray(u) ? u : u?.items ?? [])
      setBookings(Array.isArray(b) ? b : b?.items ?? [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <>
        <div className={`${s.pageHeader} ${s.section0}`}>
          <h1 className={s.pageTitle}>Dashboard</h1>
          <p className={s.pageSubtitle}>Loading platform data…</p>
        </div>
        <DashboardSkeleton />
      </>
    )
  }

  // ── Derived stats ────────────────────────────────────────────────────────
  const totalUsers       = users?.length ?? 0
  const clients          = users?.filter(u => u.role === 'client').length ?? 0
  const bizOwners        = users?.filter(u => u.role === 'business_owner').length ?? 0
  const employees        = users?.filter(u => u.role === 'employee').length ?? 0
  const admins           = users?.filter(u => u.role === 'admin').length ?? 0

  const totalBookings    = bookings?.length ?? 0
  const completedCount   = bookings?.filter(b => b.status === 'completed').length ?? 0
  const activeCount      = bookings?.filter(b => ['confirmed', 'in_progress'].includes(b.status)).length ?? 0

  const gmv              = bookings?.reduce((s, b) => s + (b.total_amount || 0), 0) ?? 0
  const platformRevenue  = bookings
    ?.filter(b => b.status === 'completed')
    .reduce((s, b) => s + (b.total_amount || 0) * 0.1, 0) ?? 0

  const now              = new Date()
  const weekAgo          = new Date(now - 7 * 86400_000)
  const bookingsThisWeek = bookings?.filter(b => b.created_at && new Date(b.created_at) >= weekAgo).length ?? 0
  const signupsThisWeek  = users?.filter(u => u.created_at && new Date(u.created_at) >= weekAgo).length ?? 0

  // ── Recent lists ─────────────────────────────────────────────────────────
  const recentBookings = [...(bookings ?? [])]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 8)

  const recentSignups = [...(users ?? [])]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 8)

  const TABLE_TH = { textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }
  const TABLE_TD = { padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }

  return (
    <>
      {/* ── Header ── */}
      <div className={`${s.pageHeader} ${s.section0}`}>
        <h1 className={s.pageTitle}>Dashboard</h1>
        <p className={s.pageSubtitle}>Platform overview · {totalUsers} users · {totalBookings} bookings · {fmtCad(gmv)} GMV</p>
      </div>

      {/* ── KPI grid ── */}
      <div className={`${s.kpiGrid} ${s.section1}`} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard label="Total users" value={fmt(totalUsers)} sub={`↑ ${signupsThisWeek} this week`} />
        <KpiCard label="Total bookings" value={fmt(totalBookings)} sub={`↑ ${bookingsThisWeek} this week`} />
        <KpiCard label="GMV (all time)" value={fmtCad(gmv)} sub="Gross merchandise value" />
        <KpiCard label="Platform revenue" value={fmtCad(platformRevenue)} sub="10% of completed GMV" />
        <KpiCard label="Clients" value={fmt(clients)} sub="role = client" />
        <KpiCard label="Business owners" value={fmt(bizOwners)} sub="role = business_owner" />
        <KpiCard label="Active bookings" value={fmt(activeCount)} sub="confirmed + in progress" />
        <KpiCard label="Completed jobs" value={fmt(completedCount)} sub={`${gmv > 0 ? ((completedCount / totalBookings * 100) || 0).toFixed(0) : 0}% completion rate`} />
      </div>

      {/* ── Recent bookings ── */}
      <div className={`${s.activityCard} ${s.section2}`}>
        <div className={s.activityToolbar}>
          <span className={s.activityTitle}>Recent bookings</span>
          <span className={s.activityMeta}>{totalBookings} total</span>
        </div>
        {recentBookings.length === 0 ? (
          <p style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: 13 }}>No bookings yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={TABLE_TH}>Booking #</th>
                  <th style={TABLE_TH}>Amount</th>
                  <th style={TABLE_TH}>Status</th>
                  <th style={TABLE_TH}>Created</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map(b => (
                  <tr key={b.id}>
                    <td style={{ ...TABLE_TD, fontWeight: 500 }}>#{b.id?.slice(0, 8)}</td>
                    <td style={TABLE_TD}>{fmtCad(b.total_amount)}</td>
                    <td style={TABLE_TD}>{statusBadge(b.status)}</td>
                    <td style={{ ...TABLE_TD, color: 'var(--color-text-secondary)' }}>
                      {b.created_at ? new Date(b.created_at).toLocaleDateString('en-CA') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent signups ── */}
      <div className={`${s.activityCard} ${s.section3}`}>
        <div className={s.activityToolbar}>
          <span className={s.activityTitle}>Recent signups</span>
          <span className={s.activityMeta}>{totalUsers} total users</span>
        </div>
        {recentSignups.length === 0 ? (
          <p style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: 13 }}>No users yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={TABLE_TH}>Name</th>
                  <th style={TABLE_TH}>Email</th>
                  <th style={TABLE_TH}>Role</th>
                  <th style={TABLE_TH}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentSignups.map(u => (
                  <tr key={u.id}>
                    <td style={{ ...TABLE_TD, fontWeight: 500 }}>
                      {u.first_name} {u.last_name}
                    </td>
                    <td style={{ ...TABLE_TD, color: 'var(--color-text-secondary)' }}>{u.email}</td>
                    <td style={TABLE_TD}>{roleBadge(u.role)}</td>
                    <td style={{ ...TABLE_TD, color: 'var(--color-text-secondary)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-CA') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Role breakdown ── */}
      <div className={`${s.chartCard} ${s.section4}`}>
        <div className={s.chartToolbar}>
          <span className={s.chartTitle}>User breakdown by role</span>
          <span className={s.chartSubtitle}>{totalUsers} total</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '16px' }}>
          {[
            { role: 'Clients', count: clients, color: '#7c3aed' },
            { role: 'Business owners', count: bizOwners, color: '#2d7af6' },
            { role: 'Employees', count: employees, color: '#059669' },
            { role: 'Admins', count: admins, color: '#dc2626' },
          ].map(({ role, count, color }) => (
            <div key={role} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{role}</div>
              <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, marginTop: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: color,
                  width: totalUsers > 0 ? `${(count / totalUsers) * 100}%` : '0%',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
