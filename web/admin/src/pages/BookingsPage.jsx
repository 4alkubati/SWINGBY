import { useEffect, useState } from 'react'
import api from '@/services/api'

const STATUS_BADGE = {
  confirmed:   'badge-blue',
  'on the way':'badge-orange',
  in_progress: 'badge-orange',
  done:        'badge-green',
  completed:   'badge-green',
  cancelled:   'badge-red',
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    api.get('/admin/bookings')
      .then((res) => setBookings(Array.isArray(res.data) ? res.data : res.data?.bookings ?? []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load bookings'))
      .finally(() => setLoading(false))
  }, [])

  function formatAmount(amount) {
    if (amount == null) return '—'
    return `AED ${Number(amount).toLocaleString()}`
  }

  return (
    <>
      <div className="page-header">
        <h1>Bookings</h1>
        <p>All bookings across the platform.</p>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>Bookings</strong>
            {!loading && <span className="count">{bookings.length} total</span>}
          </span>
        </div>

        {loading && <div className="state-loading">Loading bookings…</div>}
        {error   && <div className="state-empty" style={{ color: 'var(--red)' }}>{error}</div>}

        {!loading && !error && bookings.length === 0 && (
          <div className="state-empty">No bookings found.</div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Business</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const statusKey = booking.status?.toLowerCase().replace(' ', '_') || 'confirmed'
                return (
                  <tr key={booking.id}>
                    <td className="mono">{booking.id}</td>
                    <td>{booking.client_name || booking.client?.name || '—'}</td>
                    <td>{booking.business_name || booking.business?.name || '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[statusKey] || 'badge-muted'}`}>
                        {booking.status || 'confirmed'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--orange)', fontWeight: 600 }}>
                      {formatAmount(booking.amount || booking.quoted_price)}
                    </td>
                    <td>
                      {booking.completed_at
                        ? <span className="badge badge-green">Yes</span>
                        : <span className="badge badge-muted">No</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
