import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, CalendarCheck, ChatCircle } from '@phosphor-icons/react'
import api from '../../lib/api'
import { useUser } from '../../hooks/useUser'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import Button from '../../components/Button'
import styles from './Dashboard.module.css'

export default function ClientDashboard() {
  const { data: user } = useUser()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings/').then(r => r.data),
  })

  const active = bookings?.filter(b => !['completed', 'cancelled'].includes(b.status)) ?? []

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Hi, {user?.first_name || 'there'}!</h1>
          <p className={styles.pageSubtitle}>Welcome to your SwingBy dashboard.</p>
        </div>
        <Link to="/app/post"><Button icon={<Plus size={16} weight="bold" />}>Post a job</Button></Link>
      </div>

      <div className={styles.quickActions}>
        {[
          { to: '/app/post', icon: Plus, label: 'Post a job', desc: 'Get quotes from local businesses' },
          { to: '/app/bookings', icon: CalendarCheck, label: 'My bookings', desc: `${active.length} active` },
          { to: '/app/messages', icon: ChatCircle, label: 'Messages', desc: 'View your conversations' },
        ].map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to} className={styles.quickCard}>
            <div className={styles.quickIcon}><Icon size={22} weight="duotone" /></div>
            <div>
              <div className={styles.quickLabel}>{label}</div>
              <div className={styles.quickDesc}>{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent bookings</h2>
        {isLoading ? <Spinner /> : active.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck size={48} />}
            title="No active bookings"
            description="Post a job to get started."
            action={<Link to="/app/post"><Button>Post a job</Button></Link>}
          />
        ) : (
          <div className={styles.list}>
            {active.slice(0, 5).map(b => (
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
    </div>
  )
}
