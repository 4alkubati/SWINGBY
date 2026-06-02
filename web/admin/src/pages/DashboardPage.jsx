import { useEffect, useState } from 'react'
import api from '@/services/api'
import s from './DashboardPage.module.css'

/* ─── KPI definitions ─────────────────────────────────────────────────────── */

const KPI_DEFS = [
  { key: 'users',           label: 'Total Users',        suffix: '',    delta: 'All time' },
  { key: 'businesses',      label: 'Active Businesses',  suffix: '',    delta: 'All time' },
  { key: 'bookings_today',  label: 'Bookings Today',     suffix: '',    delta: 'Since midnight' },
  { key: 'gmv_today',       label: 'GMV Today',          suffix: ' AED', delta: 'Since midnight' },
  { key: 'avg_rating',      label: 'Avg Rating',         suffix: '',    delta: 'Platform-wide' },
  { key: 'support_tickets', label: 'Support Tickets',    suffix: '',    delta: 'Open' },
]

/* ─── Chart placeholder bars (decorative) ────────────────────────────────── */

const CHART_BARS = [14, 22, 18, 30, 25, 34, 20]

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <>
      <div className={`${s.skeletonGrid} ${s.section0}`}>
        {KPI_DEFS.map((_, i) => (
          <div className={s.skeletonCard} key={i}>
            <div className={`${s.skeletonLine} ${s.skeletonLabel}`} />
            <div className={`${s.skeletonLine} ${s.skeletonValue}`} />
            <div className={`${s.skeletonLine} ${s.skeletonDelta}`} />
          </div>
        ))}
      </div>

      <div className={`${s.skeletonChartCard} ${s.section1}`}>
        <div className={s.skeletonChartTitle} />
        <div className={s.skeletonChartBody} />
      </div>

      <div className={`${s.skeletonActivityCard} ${s.section2}`}>
        <div className={s.skeletonActivityTitle} />
        <div className={s.skeletonActivityRow} />
        <div className={s.skeletonActivityRow} />
        <div className={s.skeletonActivityRow} />
      </div>
    </>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats')
      .then((res) => setStats(res.data ?? {}))
      .catch(() => setStats({}))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <>
        <div className={`${s.pageHeader} ${s.section0}`}>
          <h1 className={s.pageTitle}>Dashboard</h1>
          <p className={s.pageSubtitle}>Platform overview — live numbers once endpoints are ready.</p>
        </div>
        <DashboardSkeleton />
      </>
    )
  }

  const get = (key) => {
    const val = stats?.[key]
    if (val === undefined || val === null || val === '') return '—'
    return val
  }

  return (
    <>
      {/* Header */}
      <div className={`${s.pageHeader} ${s.section0}`}>
        <h1 className={s.pageTitle}>Dashboard</h1>
        <p className={s.pageSubtitle}>Platform overview — live numbers once endpoints are ready.</p>
      </div>

      {/* KPI Grid */}
      <div className={`${s.kpiGrid} ${s.section1}`}>
        {KPI_DEFS.map(({ key, label, suffix, delta }) => {
          const raw = get(key)
          const display = raw === '—' ? '—' : `${raw}${suffix}`
          return (
            <div className={s.kpiCard} key={key}>
              <div className={s.kpiLabel}>{label}</div>
              <div className={s.kpiValue}>{display}</div>
              <div className={s.kpiDelta}>{delta}</div>
            </div>
          )
        })}
      </div>

      {/* Bookings Over 7 Days — chart placeholder */}
      <div className={`${s.chartCard} ${s.section2}`}>
        <div className={s.chartToolbar}>
          <span className={s.chartTitle}>Bookings Over 7 Days</span>
          <span className={s.chartSubtitle}>Last 7 days</span>
        </div>
        <div className={s.chartBody}>
          <div className={s.chartEmptyLabel}>Preview</div>
          <div className={s.chartEmptyDots} aria-hidden="true">
            {CHART_BARS.map((h, i) => (
              <div
                key={i}
                className={s.chartEmptyDot}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
          <p className={s.chartEmptyText}>
            Chart available when analytics endpoint is live
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className={`${s.activityCard} ${s.section3}`}>
        <div className={s.activityToolbar}>
          <span className={s.activityTitle}>Recent Activity</span>
          <span className={s.activityMeta}>Live feed</span>
        </div>
        <div className={s.activityEmpty}>
          <div className={s.activityEmptyIcon} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={s.activityEmptyIconSvg}>
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
          </div>
          <p className={s.activityEmptyTitle}>No activity yet</p>
          <p className={s.activityEmptyText}>
            Booking events and platform actions will appear here once the activity endpoint is live.
          </p>
        </div>
      </div>
    </>
  )
}
