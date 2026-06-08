import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChartBar, CurrencyDollar, CalendarCheck, Users, ArrowRight } from '@phosphor-icons/react'
import api from '../../lib/api'
import { useUser } from '../../hooks/useUser'
import StatCard from '../../components/StatCard'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import Button from '../../components/Button'
import styles from './Dashboard.module.css'

export default function BizDashboard() {
  const { data: user } = useUser()

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings/').then(r => r.data),
  })

  const { data: biz } = useQuery({
    queryKey: ['myBusiness'],
    queryFn: () => api.get('/businesses/me').then(r => r.data),
  })

  const completed = bookings?.filter(b => b.status === 'completed') ?? []
  const active = bookings?.filter(b => !['completed', 'cancelled'].includes(b.status)) ?? []
  const grossRevenue = completed.reduce((sum, b) => sum + (b.total_amount || 0), 0)
  const netEarnings = grossRevenue * 0.9

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{biz?.business_name || 'Your business'}</h1>
          <p className={styles.pageSubtitle}>Business dashboard · {user?.first_name}</p>
        </div>
        <Link to="/app/business/analytics"><Button variant="secondary" icon={<ChartBar size={16} />}>Analytics</Button></Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-2xl)' }}>
        <StatCard label="Completed bookings" value={completed.length} icon={CalendarCheck} />
        <StatCard label="Gross revenue" value={grossRevenue} format="currency" icon={CurrencyDollar} />
        <StatCard label="Net earnings" value={netEarnings} format="currency" icon={CurrencyDollar} />
        <StatCard label="Avg rating" value={biz?.avg_rating || null} format="rating" icon={ChartBar} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-xl)' }}>
        <div>
          <h2 className={styles.sectionTitle}>Active bookings</h2>
          {bookingsLoading ? <Spinner size={20} /> : active.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={40} />} title="No active bookings" description="Bookings will appear here." />
          ) : (
            <div className={styles.list}>
              {active.slice(0, 8).map(b => (
                <Link key={b.id} to={`/app/bookings/${b.id}`} className={styles.listItem}>
                  <div>
                    <div className={styles.listTitle}>Booking #{b.id.slice(0, 8)}</div>
                    <div className={styles.listSub}>${b.total_amount} · {b.status}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className={styles.sectionTitle}>Quick links</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
  )
}
