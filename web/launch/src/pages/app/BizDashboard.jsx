import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChartBar, CurrencyDollar, CalendarCheck, Users, ArrowRight, Star,
  LockSimple, ArrowSquareOut,
} from '@phosphor-icons/react'
import api from '../../lib/api'
import { useUser } from '../../hooks/useUser'
import StatCard from '../../components/StatCard'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import Button from '../../components/Button'
import styles from './Dashboard.module.css'
import bizStyles from './BizDashboard.module.css'

// > TODO (HUMAN): add GET /businesses/me/analytics backend endpoint for server-side
// > aggregation when booking volume grows. For now everything is client-side.

function statusBadge(status) {
  const map = {
    confirmed: { label: 'Confirmed', color: '#2d7af6' },
    in_progress: { label: 'In progress', color: '#f59e0b' },
    completed: { label: 'Completed', color: '#16a34a' },
    cancelled: { label: 'Cancelled', color: '#dc2626' },
  }
  const s = map[status] || { label: status, color: '#6b7280' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
      color: s.color, background: `${s.color}18`,
      borderRadius: 4, padding: '2px 7px',
    }}>
      {s.label}
    </span>
  )
}

function EscrowTracker({ bookings }) {
  const all = bookings ?? []
  const totalAmount = all.reduce((s, b) => s + (b.total_amount || 0), 0)
  const released = all
    .filter(b => b.payment_status === 'released' || b.status === 'completed')
    .reduce((s, b) => s + (b.total_amount || 0) * 0.9, 0)
  const held = all
    .filter(b => ['confirmed', 'in_progress'].includes(b.status))
    .reduce((s, b) => s + (b.total_amount || 0) * 0.5, 0)

  const releasedPct = totalAmount > 0 ? Math.round((released / (totalAmount * 0.9 || 1)) * 100) : 0

  return (
    <div className={bizStyles.escrowCard}>
      <div className={bizStyles.escrowTitle}>
        <LockSimple size={16} weight="fill" style={{ color: 'var(--color-accent)' }} />
        Escrow tracker
      </div>
      <div className={bizStyles.escrowRow}>
        <span className={bizStyles.escrowLabel}>Released</span>
        <span className={bizStyles.escrowValue}>${released.toFixed(2)}</span>
      </div>
      <div className={bizStyles.escrowBar}>
        <div className={bizStyles.escrowFill} style={{ width: `${releasedPct}%` }} />
      </div>
      <div className={bizStyles.escrowRow}>
        <span className={bizStyles.escrowLabel}>In escrow (held)</span>
        <span className={bizStyles.escrowValue}>${held.toFixed(2)}</span>
      </div>
      <p className={bizStyles.escrowHint}>
        50% released on booking confirmation · 50% on completion · 10% platform fee deducted on final release.
      </p>
    </div>
  )
}

function TeamOnDuty({ employees, bookings }) {
  if (!employees || employees.length === 0) {
    return (
      <div className={bizStyles.teamCard}>
        <div className={bizStyles.escrowTitle}><Users size={16} weight="fill" /> Team on duty</div>
        <EmptyState title="No team members" description="Add employees to see who's on duty today." />
      </div>
    )
  }
  const today = new Date().toDateString()
  const todayBookings = (bookings ?? []).filter(b => {
    if (!b.scheduled_date) return false
    return new Date(b.scheduled_date).toDateString() === today
  })

  return (
    <div className={bizStyles.teamCard}>
      <div className={bizStyles.escrowTitle}><Users size={16} weight="fill" /> Team on duty today</div>
      {employees.filter(e => e.is_active).slice(0, 6).map(emp => {
        const count = todayBookings.filter(b => b.employee_id === emp.user_id).length
        return (
          <div key={emp.id} className={bizStyles.teamRow}>
            <div className={bizStyles.teamAvatar}>
              {emp.first_name?.[0] ?? emp.role_title?.[0] ?? 'E'}
            </div>
            <div className={bizStyles.teamInfo}>
              <span className={bizStyles.teamName}>{emp.first_name ?? emp.role_title}</span>
              <span className={bizStyles.teamRole}>{emp.role_title}</span>
            </div>
            <span className={bizStyles.teamCount}>{count} job{count !== 1 ? 's' : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function BizDashboard() {
  const { data: user } = useUser()

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings/').then(r => r.data),
  })

  const { data: bizData } = useQuery({
    queryKey: ['myBusiness'],
    queryFn: () => api.get('/businesses/me').then(r => r.data),
  })

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees/').then(r => r.data),
  })

  const bookings = Array.isArray(bookingsData)
    ? bookingsData
    : bookingsData?.items ?? []

  const completed = bookings.filter(b => b.status === 'completed')
  const active = bookings.filter(b => !['completed', 'cancelled'].includes(b.status))
  const grossRevenue = completed.reduce((sum, b) => sum + (b.total_amount || 0), 0)
  const netEarnings = grossRevenue * 0.9
  const inEscrow = active.reduce((sum, b) => sum + ((b.total_amount || 0) * 0.5), 0)

  const recentJobs = [...bookings]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 8)

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{bizData?.business_name || 'Your business'}</h1>
          <p className={styles.pageSubtitle}>
            Business dashboard · {user?.first_name}
            {bizData?.avg_rating ? ` · ${bizData.avg_rating.toFixed(1)} ★ (${bizData.review_count ?? 0} reviews)` : ''}
          </p>
        </div>
        <Link to="/app/business/analytics">
          <Button variant="secondary" icon={<ChartBar size={16} />}>Analytics</Button>
        </Link>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-2xl)' }}>
        <StatCard label="Net earnings" value={netEarnings} format="currency" icon={CurrencyDollar} deltaLabel="After 10% fee" />
        <StatCard label="Jobs completed" value={completed.length} icon={CalendarCheck} deltaLabel="All time" />
        <StatCard label="Avg rating" value={bizData?.avg_rating ?? null} format="rating" icon={Star} />
        <StatCard label="In escrow" value={inEscrow} format="currency" icon={LockSimple} deltaLabel="Active bookings" />
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-xl)', alignItems: 'start' }}>

        {/* Left: recent jobs table */}
        <div>
          <h2 className={styles.sectionTitle}>Recent jobs</h2>
          {bookingsLoading ? <Spinner size={20} /> : recentJobs.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={40} />} title="No bookings yet" description="Bookings will appear here." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Job #', 'Amount', 'Status', 'Date', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                        #{b.id.slice(0, 8)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        ${(b.total_amount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{statusBadge(b.status)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                        {b.scheduled_date ? new Date(b.scheduled_date).toLocaleDateString('en-CA') : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Link to={`/app/bookings/${b.id}`} style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ArrowSquareOut size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {recentJobs.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Link to="/app/bookings" style={{ fontSize: 13, color: 'var(--color-accent)' }}>
                View all bookings →
              </Link>
            </div>
          )}
        </div>

        {/* Right: escrow tracker + team on duty + quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <EscrowTracker bookings={bookings} />
          <TeamOnDuty employees={employees} bookings={bookings} />

          <div>
            <h2 className={styles.sectionTitle}>Quick links</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { to: '/app/business/analytics', label: 'Analytics', icon: ChartBar },
                { to: '/app/business/earnings', label: 'Earnings', icon: CurrencyDollar },
                { to: '/app/business/employees', label: 'Team', icon: Users },
                { to: '/app/business/exports', label: 'Export data', icon: ArrowRight },
              ].map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className={styles.listItem}>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{label}</span>
                  <Icon size={16} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
