import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from '@phosphor-icons/react'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'
import Button from '../../components/Button'
import Badge from '../../components/Badge'
import toast from 'react-hot-toast'

const STATUS_VARIANT = { confirmed: 'accent', in_progress: 'warning', completed: 'success', cancelled: 'danger' }

export default function BookingDetail() {
  const { id } = useParams()
  const qc = useQueryClient()

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
  })

  const complete = useMutation({
    mutationFn: () => api.patch(`/bookings/${id}/complete`),
    onSuccess: () => { qc.invalidateQueries(['booking', id]); toast.success('Booking marked as complete.') },
    onError: () => toast.error('Could not complete booking'),
  })

  if (isLoading) return <Spinner />
  if (!booking) return <p style={{ color: 'var(--color-text-secondary)' }}>Booking not found.</p>

  return (
    <div>
      <Link to="/app/bookings" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-accent-text)', marginBottom: 'var(--space-lg)' }}>
        <ArrowLeft size={16} /> Bookings
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '24px', color: 'var(--color-text-primary)' }}>Booking #{id.slice(0, 8)}</h1>
        <Badge variant={STATUS_VARIANT[booking.status] || 'default'}>{booking.status}</Badge>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        {[
          ['Total amount', `$${booking.total_amount}`],
          ['Payment status', booking.payment_status],
          ['Payment status', booking.payment_status],
          ['Booking ID', booking.id.slice(0, 16) + '…'],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-base)' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
        {booking.status === 'confirmed' && (
          <Button onClick={() => complete.mutate()} loading={complete.isPending}>Mark as complete</Button>
        )}
        <Link to={`/app/messages/${booking.id}`}><Button variant="secondary">View messages</Button></Link>
      </div>
    </div>
  )
}
