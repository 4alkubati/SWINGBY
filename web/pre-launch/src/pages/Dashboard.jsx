import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Dashboard.module.css'

function formatJoinDate(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function computeCompleteness(user) {
  const meta = user.user_metadata || {}
  const emailConfirmed = !!user.email_confirmed_at
  const hasAvatar = !!(meta.avatar_url || user.avatar_url)
  const checks = [
    {
      label: emailConfirmed ? 'Email verified' : 'Confirm your email',
      done: emailConfirmed,
      action: emailConfirmed ? null : { label: 'Resend link', to: `/verify-email?email=${encodeURIComponent(user.email || '')}` },
    },
    { label: 'Account created',         done: true,  action: null },
    { label: 'Profile photo added',     done: hasAvatar, action: hasAvatar ? null : { label: 'Add photo', to: '/profile' } },
    { label: 'First booking completed', done: false,    action: { label: 'Browse services', to: '/categories' } },
    { label: 'Payment method added',    done: false,    action: { label: 'Add method', to: '/payment-methods' } },
  ]
  const doneCount = checks.filter(c => c.done).length
  const pct = Math.round((doneCount / checks.length) * 100)
  return { checks, pct }
}

function LoadingSkeleton() {
  return (
    <div className={styles.skeletonWrapper}>
      {/* Header */}
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonLine} style={{ width: '240px', height: '28px' }} />
        <div className={styles.skeletonLine} style={{ width: '160px', height: '14px', marginTop: '4px' }} />
      </div>

      {/* KPI cards */}
      <div className={styles.skeletonKpiGrid}>
        <div className={styles.skeletonKpi} />
        <div className={styles.skeletonKpi} />
        <div className={styles.skeletonKpi} />
      </div>

      {/* Profile completeness */}
      <div className={styles.skeletonBlock} style={{ height: '180px' }} />

      {/* CTA */}
      <div className={styles.skeletonBlock} style={{ height: '96px' }} />

      {/* Activity */}
      <div className={styles.skeletonBlock} style={{ height: '160px' }} />
    </div>
  )
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  if (loading) return <LoadingSkeleton />
  if (!user) return null

  const meta = user.user_metadata || {}
  const firstName = meta.first_name || user.email.split('@')[0]
  const fullName = meta.first_name
    ? `${meta.first_name} ${meta.last_name || ''}`.trim()
    : user.email
  const avatarInitial = (meta.first_name?.[0] || user.email[0]).toUpperCase()
  const role = meta.role === 'business_owner' ? 'Business owner' : 'Client'
  const joinDate = formatJoinDate(user.created_at)
  const { checks, pct } = computeCompleteness(user)

  return (
    <div className={styles.page}>

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>SwingBy</Link>

        <div className={styles.navRight}>
          <div className={styles.navUser}>
            <div className={styles.navUserInfo}>
              <span className={styles.navName}>{fullName}</span>
              <span className={styles.navEmail}>{user.email}</span>
            </div>
            <div className={styles.avatar}>{avatarInitial}</div>
          </div>
          <button onClick={handleSignOut} className={styles.signOutBtn}>
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className={styles.main}>

        {/* 1. Welcome header */}
        <header className={`${styles.welcomeHeader} ${styles.section0}`}>
          <h1 className={styles.welcomeTitle}>Welcome back, {firstName}</h1>
          <p className={styles.welcomeSubtitle}>Your SwingBy dashboard</p>
        </header>

        {/* 2. KPI row */}
        <div className={`${styles.kpiGrid} ${styles.section1}`}>

          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Account Status</span>
            <span className={`${styles.kpiValue} ${styles.kpiValueSuccess}`}>
              <span className={styles.statusDot} />
              Early access
            </span>
          </div>

          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Member Since</span>
            <span className={`${styles.kpiValue} ${styles.kpiValueSecondary}`}>
              {joinDate}
            </span>
          </div>

          <div className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Role</span>
            <span className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
              {role}
            </span>
          </div>

        </div>

        {/* 3. Profile completeness */}
        <div className={`${styles.card} ${styles.section2}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Profile completeness</h2>
            <span className={styles.cardTitleAccent}>{pct}%</span>
          </div>

          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${pct}%` }}
            />
          </div>

          <ul className={styles.checklist}>
            {checks.map(({ label, done, action }) => (
              <li
                key={label}
                className={`${styles.checkItem} ${done ? styles.checkItemDone : styles.checkItemPending}`}
              >
                {done ? (
                  <span className={styles.checkIcon}>✓</span>
                ) : (
                  <span className={styles.checkCircle} />
                )}
                <span style={{ flex: 1 }}>{label}</span>
                {action && (
                  <Link to={action.to} className={styles.checkAction} style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent, #6c5ce7)', textDecoration: 'none', marginLeft: 'auto' }}>
                    {action.label} →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Mobile app CTA */}
        <div className={`${styles.ctaCard} ${styles.section3}`}>
          <span className={styles.ctaIcon}>📱</span>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Get the SwingBy app</h2>
            <p className={styles.ctaSubtitle}>
              Book services on the go. Available for iOS and Android.
            </p>
          </div>
          <button className={styles.ctaBtn}>Download</button>
        </div>

        {/* 5. Recent activity */}
        <div className={`${styles.card} ${styles.section4}`}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Recent activity</h2>
          </div>

          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            <p className={styles.emptyTitle}>No activity yet</p>
            <p className={styles.emptyText}>
              Your bookings and messages will appear here once SwingBy launches.
            </p>
          </div>
        </div>

      </main>
    </div>
  )
}
