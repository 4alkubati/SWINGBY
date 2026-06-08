import { useQuery } from '@tanstack/react-query'
import { Wrench, ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import styles from './Dashboard.module.css'

const SERVICE_FEATURES = [
  'Service category sets where you appear in client searches.',
  'Your service radius controls which client posts you can express interest in.',
  'Update your description to highlight pricing, experience, or specialties.',
]

export default function BusinessServices() {
  const { data: biz, isLoading, isError } = useQuery({
    queryKey: ['myBusiness'],
    queryFn: () => api.get('/businesses/me').then(r => r.data),
  })

  const { data: bookings } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings/').then(r => r.data),
    enabled: !!biz,
  })

  if (isLoading) return <Spinner />
  if (isError) return <Alert type="error" message="Could not load your business." />

  const categoryBreakdown = (bookings ?? []).reduce((acc, b) => {
    const cat = b.category || biz?.category || 'General'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  const totalBookings = Object.values(categoryBreakdown).reduce((s, v) => s + v, 0)

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Services</h1>
          <p className={styles.pageSubtitle}>Manage what services your business offers</p>
        </div>
        <Link to="/app/business/profile">
          <button style={{ padding: '8px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px', cursor: 'pointer' }}>
            Edit profile
          </button>
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
        <div>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <Wrench size={20} style={{ color: 'var(--color-accent-text)' }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--color-text-primary)' }}>Current offering</h2>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px 16px', fontSize: '14px' }}>
              <dt style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Category</dt>
              <dd style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{biz.category || '—'}</dd>
              <dt style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Radius</dt>
              <dd style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{biz.service_radius_km} km</dd>
              <dt style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Rating</dt>
              <dd style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{biz.avg_rating ? `${biz.avg_rating} / 5 (${biz.review_count} reviews)` : 'No reviews yet'}</dd>
              <dt style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Status</dt>
              <dd style={{ color: biz.license_status === 'verified' ? 'var(--color-success)' : 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>{biz.license_status || 'Pending'}</dd>
            </dl>
            {biz.description && (
              <p style={{ marginTop: 'var(--space-md)', fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{biz.description}</p>
            )}
            <Link to="/app/business/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: 'var(--space-md)', fontSize: '13px', color: 'var(--color-accent-text)', textDecoration: 'none', fontWeight: 500 }}>
              Edit profile <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-md)' }}>How services work</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', paddingLeft: 0, listStyle: 'none' }}>
              {SERVICE_FEATURES.map((f, i) => (
                <li key={i} style={{ display: 'flex', gap: 'var(--space-sm)', fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--color-accent-text)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h2 className={styles.sectionTitle}>Booking breakdown</h2>
          {totalBookings === 0 ? (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-xl)', textAlign: 'center' }}>
              <Wrench size={40} style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }} />
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>No bookings yet. Breakdown will appear here once you start serving clients.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{cat}</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{count} bookings</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / totalBookings) * 100}%`, background: 'var(--color-accent)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
