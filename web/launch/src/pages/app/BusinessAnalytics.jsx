import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format, subDays, parseISO, startOfDay, isWithinInterval } from 'date-fns'
import { CurrencyDollar, CalendarCheck, Star } from '@phosphor-icons/react'
import api from '../../lib/api'
import Skeleton from '../../components/Skeleton'
import Alert from '../../components/Alert'
import StatCard from '../../components/StatCard'
import styles from './Dashboard.module.css'

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

const ACCENT = '#6E56F7'
const ACCENT_DIM = '#9C88FF'
const SUCCESS = '#22c55e'
const WARNING = '#f59e0b'
const DONUT_COLORS = [ACCENT, ACCENT_DIM, SUCCESS, WARNING, '#e11d48', '#0ea5e9']

const CUSTOM_TOOLTIP_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  fontSize: '13px',
  color: 'var(--color-text-primary)',
}

export default function BusinessAnalytics() {
  const [rangeIdx, setRangeIdx] = useState(1)
  const range = RANGES[rangeIdx]

  // Use existing bookings endpoint — analytics endpoint is TODO (HUMAN): add GET /businesses/me/analytics
  const { data: bookings = [], isLoading: bLoading, isError: bError } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings/').then(r => r.data),
  })

  const { data: biz } = useQuery({
    queryKey: ['myBusiness'],
    queryFn: () => api.get('/businesses/me').then(r => r.data),
  })

  useQuery({
    queryKey: ['reviews-biz', biz?.id],
    queryFn: () => api.get(`/reviews/business/${biz.id}`).then(r => r.data),
    enabled: !!biz?.id,
  })

  const cutoff = useMemo(() => startOfDay(subDays(new Date(), range.days)), [range.days])

  const inRange = useMemo(() => bookings.filter(b => {
    try { return isWithinInterval(parseISO(b.created_at), { start: cutoff, end: new Date() }) }
    catch { return false }
  }), [bookings, cutoff])

  const prevCutoff = useMemo(() => startOfDay(subDays(new Date(), range.days * 2)), [range.days])
  const prevRange = useMemo(() => bookings.filter(b => {
    try { return isWithinInterval(parseISO(b.created_at), { start: prevCutoff, end: cutoff }) }
    catch { return false }
  }), [bookings, prevCutoff, cutoff])

  const completed = inRange.filter(b => b.status === 'completed')
  const prevCompleted = prevRange.filter(b => b.status === 'completed')
  const gross = completed.reduce((s, b) => s + (b.total_amount || 0), 0)
  const prevGross = prevCompleted.reduce((s, b) => s + (b.total_amount || 0), 0)
  const net = gross * 0.9
  const prevNet = prevGross * 0.9

  function delta(curr, prev) {
    if (!prev) return null
    return ((curr - prev) / prev) * 100
  }

  // Daily revenue for area chart
  const dailyData = useMemo(() => {
    const days = []
    for (let i = range.days - 1; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i))
      const dayStr = format(day, 'MMM d')
      const dayBookings = completed.filter(b => {
        try { return format(parseISO(b.created_at), 'MMM d') === dayStr }
        catch { return false }
      })
      days.push({ date: dayStr, gross: dayBookings.reduce((s, b) => s + (b.total_amount || 0), 0), count: dayBookings.length })
    }
    return days
  }, [completed, range.days])

  // Booking funnel
  const funnelData = useMemo(() => {
    const all = inRange.length
    const confirmed = inRange.filter(b => ['confirmed', 'in_progress', 'completed'].includes(b.status)).length
    const comp = completed.length
    const cancelled = inRange.filter(b => b.status === 'cancelled').length
    return [
      { name: 'Bookings received', value: all },
      { name: 'Confirmed', value: confirmed },
      { name: 'Completed', value: comp },
      { name: 'Cancelled', value: cancelled },
    ]
  }, [inRange, completed])

  // Status donut
  const statusData = useMemo(() => {
    const counts = {}
    inRange.forEach(b => { counts[b.status] = (counts[b.status] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [inRange])

  // Monthly bookings bar chart (last 6 months)
  const monthlyData = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = subDays(new Date(), i * 30)
      const label = format(d, 'MMM')
      const start = startOfDay(subDays(d, 15))
      const end = startOfDay(subDays(d, -15))
      const count = bookings.filter(b => {
        try { return isWithinInterval(parseISO(b.created_at), { start, end }) }
        catch { return false }
      }).length
      months.push({ month: label, bookings: count })
    }
    return months
  }, [bookings])

  if (bLoading) return (
    <div>
      <div style={{ marginBottom: 'var(--space-xl)' }}><Skeleton width={200} height={28} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} height={96} />)}
      </div>
      <Skeleton height={240} style={{ marginBottom: 'var(--space-lg)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-lg)' }}>
        {[1, 2, 3].map(i => <Skeleton key={i} height={200} />)}
      </div>
    </div>
  )
  if (bError) return <Alert type="error" message="Could not load analytics data." />

  const statDelta = delta(gross, prevGross)

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Analytics</h1>
          <p className={styles.pageSubtitle}>{biz?.business_name} · Revenue & performance</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px' }}>
          {RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setRangeIdx(i)} style={{ padding: '6px 14px', borderRadius: 'calc(var(--radius-sm) - 2px)', border: 'none', background: rangeIdx === i ? 'var(--color-accent)' : 'transparent', color: rangeIdx === i ? '#fff' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <StatCard label="Gross revenue" value={gross} format="currency" icon={CurrencyDollar} delta={statDelta} />
        <StatCard label="Net earnings (90%)" value={net} format="currency" icon={CurrencyDollar} delta={delta(net, prevNet)} />
        <StatCard label="Completed bookings" value={completed.length} icon={CalendarCheck} delta={delta(completed.length, prevCompleted.length)} />
        <StatCard label="Avg rating" value={biz?.avg_rating || null} format="rating" icon={Star} />
      </div>

      {/* Revenue area chart */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-lg)' }}>Revenue over time</h2>
        {dailyData.every(d => d.gross === 0) ? (
          <EmptyChart message="No completed bookings in this period." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v) => [`$${v.toFixed(2)}`, 'Gross revenue']} />
              <Area type="monotone" dataKey="gross" stroke={ACCENT} strokeWidth={2} fill="url(#grossGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom row: funnel + donut + monthly bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-lg)' }}>
        {/* Booking funnel */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-md)' }}>Booking funnel</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {funnelData.map((item, i) => {
              const max = funnelData[0].value || 1
              const pct = (item.value / max) * 100
              return (
                <div key={item.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{item.name}</span>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{item.value}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: i === funnelData.length - 1 ? 'var(--color-danger)' : ACCENT, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status donut */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-md)' }}>Status breakdown</h2>
          {statusData.length === 0 ? (
            <EmptyChart message="No bookings in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                  {statusData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', color: 'var(--color-text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly bookings bar */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-md)' }}>Monthly volume</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
              <Bar dataKey="bookings" fill={ACCENT} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function EmptyChart({ message }) {
  return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{message}</p>
    </div>
  )
}
