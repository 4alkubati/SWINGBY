import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, subDays, isWithinInterval, startOfDay } from 'date-fns'
import { CurrencyDollar, ArrowDown, ArrowUp, Clock } from '@phosphor-icons/react'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import Badge from '../../components/Badge'
import styles from './Dashboard.module.css'

const RANGES = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: 99999 },
]

function fmt(n) {
  return `$${Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function statusBadge(status) {
  const map = { released: 'success', held: 'warning', pending: 'default', cancelled: 'danger' }
  return map[status] || 'default'
}

export default function BusinessEarnings() {
  const [rangeIdx, setRangeIdx] = useState(0)
  const range = RANGES[rangeIdx]

  const { data: bookings = [], isLoading: bLoading, isError: bError } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings/').then(r => r.data),
  })

  const cutoff = useMemo(() => range.days > 9000 ? new Date(0) : startOfDay(subDays(new Date(), range.days)), [range.days])

  const inRange = useMemo(() => bookings.filter(b => {
    try { return isWithinInterval(parseISO(b.created_at), { start: cutoff, end: new Date() }) }
    catch { return false }
  }), [bookings, cutoff])

  const completed = inRange.filter(b => b.status === 'completed')
  const inProgress = inRange.filter(b => b.status === 'in_progress' || b.status === 'confirmed')

  const grossRevenue = completed.reduce((s, b) => s + (b.total_amount || 0), 0)
  const platformFee = grossRevenue * 0.10
  const netEarnings = grossRevenue * 0.90

  // Escrow: 50% of active booking amounts held
  const escrowHeld = inProgress.reduce((s, b) => s + (b.total_amount || 0) * 0.5, 0)

  // Build ledger rows from bookings
  const ledger = useMemo(() => {
    const rows = []
    inRange.forEach(b => {
      if (b.status === 'completed') {
        rows.push({
          id: b.id,
          type: 'payout',
          description: `Booking #${b.id.slice(0, 8)} completed`,
          amount: b.total_amount * 0.9,
          gross: b.total_amount,
          fee: b.total_amount * 0.1,
          date: b.updated_at || b.created_at,
          status: 'released',
        })
      } else if (['confirmed', 'in_progress'].includes(b.status)) {
        rows.push({
          id: b.id,
          type: 'escrow',
          description: `Booking #${b.id.slice(0, 8)} — 50% held in escrow`,
          amount: b.total_amount * 0.5,
          gross: b.total_amount,
          fee: null,
          date: b.created_at,
          status: 'held',
        })
      } else if (b.status === 'cancelled') {
        rows.push({
          id: b.id,
          type: 'cancelled',
          description: `Booking #${b.id.slice(0, 8)} cancelled`,
          amount: 0,
          gross: b.total_amount,
          fee: null,
          date: b.updated_at || b.created_at,
          status: 'cancelled',
        })
      }
    })
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [inRange])

  if (bLoading) return <Spinner />
  if (bError) return <Alert type="error" message="Could not load earnings data." />

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Earnings</h1>
          <p className={styles.pageSubtitle}>Payout schedule and transaction history</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px' }}>
          {RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setRangeIdx(i)} style={{ padding: '6px 14px', borderRadius: 'calc(var(--radius-sm) - 2px)', border: 'none', background: rangeIdx === i ? 'var(--color-accent)' : 'transparent', color: rangeIdx === i ? '#fff' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {[
          { label: 'Gross revenue', value: grossRevenue, icon: CurrencyDollar, sub: `${completed.length} completed bookings` },
          { label: 'Platform fee (10%)', value: platformFee, icon: ArrowUp, sub: 'SwingBy service fee', danger: true },
          { label: 'Net earnings', value: netEarnings, icon: ArrowDown, sub: 'After SwingBy fee', success: true },
          { label: 'In escrow', value: escrowHeld, icon: Clock, sub: `${inProgress.length} active bookings` },
        ].map(({ label, value, icon: Icon, sub, danger, success }) => (
          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Icon size={16} style={{ color: danger ? 'var(--color-danger)' : success ? 'var(--color-success)' : 'var(--color-accent-text)' }} />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)', color: danger ? 'var(--color-danger)' : success ? 'var(--color-success)' : 'var(--color-text-primary)' }}>{fmt(value)}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Escrow explainer */}
      <div style={{ background: 'rgba(110,86,247,0.08)', border: '1px solid rgba(110,86,247,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md) var(--space-lg)', marginBottom: 'var(--space-xl)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>Payout schedule:</strong> 50% released when a booking is confirmed. Remaining 50% (minus 10% platform fee) released when the job is marked complete. Founder pricing: first 100 businesses pay 5% instead of 10%.
      </div>

      {/* Transaction ledger */}
      <h2 className={styles.sectionTitle}>Transaction history</h2>
      {ledger.length === 0 ? (
        <div style={{ padding: 'var(--space-xl)', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <CurrencyDollar size={40} style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }} />
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>No transactions in this period.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Date', 'Description', 'Gross', 'Fee', 'Net', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, i) => (
                <tr key={row.id + i} style={{ borderBottom: i < ledger.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {row.date ? format(parseISO(row.date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{row.description}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{fmt(row.gross)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-danger)' }}>{row.fee != null ? `-${fmt(row.fee)}` : '—'}</td>
                  <td style={{ padding: '12px 16px', color: row.status === 'released' ? 'var(--color-success)' : 'var(--color-text-primary)', fontWeight: 600 }}>{row.status === 'cancelled' ? '—' : fmt(row.amount)}</td>
                  <td style={{ padding: '12px 16px' }}><Badge variant={statusBadge(row.status)}>{row.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
