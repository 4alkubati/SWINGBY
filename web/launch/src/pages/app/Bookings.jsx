import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck } from '@phosphor-icons/react'
import api from '../../lib/api'
import Skeleton from '../../components/Skeleton'
import EmptyState from '../../components/EmptyState'
import Badge from '../../components/Badge'
import styles from './Dashboard.module.css'

const STATUS_VARIANT = { confirmed: 'accent', in_progress: 'warning', completed: 'success', cancelled: 'danger' }

export default function Bookings() {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings/').then(r => r.data),
  })

  return (
    <div>
      <h1 className={styles.pageTitle}>Bookings</h1>
      {isLoading ? (
        <div className={styles.list} style={{ marginTop: 'var(--space-lg)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className={styles.listItem} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <Skeleton width={160} height={16} />
                <Skeleton width={120} height={12} />
              </div>
              <Skeleton width={80} height={24} />
            </div>
          ))}
        </div>
      ) : !bookings?.length ? (
        <EmptyState icon={<CalendarCheck size={48} />} title="No bookings yet" description="Your bookings will appear here once you accept a quote or get hired." />
      ) : (
        <div className={styles.list} style={{ marginTop: 'var(--space-lg)' }}>
          {bookings.map(b => (
            <Link key={b.id} to={`/app/bookings/${b.id}`} className={styles.listItem}>
              <div>
                <div className={styles.listTitle}>Booking #{b.id.slice(0, 8)}</div>
                <div className={styles.listSub}>${b.total_amount} · {b.payment_status}</div>
              </div>
              <Badge variant={STATUS_VARIANT[b.status] || 'default'}>{b.status}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
