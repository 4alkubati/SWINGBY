import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChatCircle } from '@phosphor-icons/react'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import styles from './Dashboard.module.css'

export default function Messages() {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings/').then(r => r.data),
  })

  const confirmed = bookings?.filter(b => ['confirmed', 'in_progress', 'completed'].includes(b.status)) ?? []

  return (
    <div>
      <h1 className={styles.pageTitle}>Messages</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 'var(--space-sm) 0 var(--space-lg)' }}>Messages are available on confirmed bookings only.</p>
      {isLoading ? <Spinner /> : confirmed.length === 0 ? (
        <EmptyState icon={<ChatCircle size={48} />} title="No messages yet" description="Once you have a confirmed booking, you can message the other party here." />
      ) : (
        <div className={styles.list}>
          {confirmed.map(b => (
            <Link key={b.id} to={`/app/messages/${b.id}`} className={styles.listItem}>
              <div>
                <div className={styles.listTitle}>Booking #{b.id.slice(0, 8)}</div>
                <div className={styles.listSub}>{b.status}</div>
              </div>
              <ChatCircle size={18} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
