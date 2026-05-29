import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Auth.module.css'

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

  if (loading || !user) return null

  const meta = user.user_metadata || {}
  const name = meta.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : user.email

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>SwingBy</Link>
        <button onClick={handleSignOut} className={styles.signOutBtn}>Sign out</button>
      </nav>

      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.dashHeader}>
            <div className={styles.avatar}>
              {(meta.first_name?.[0] || user.email[0]).toUpperCase()}
            </div>
            <div>
              <h1>Welcome, {name}</h1>
              <p className={styles.dashEmail}>{user.email}</p>
            </div>
          </div>

          <div className={styles.dashGrid}>
            <div className={styles.dashTile}>
              <div className={styles.tileLabel}>Role</div>
              <div className={styles.tileValue}>
                {meta.role === 'business_owner' ? 'Business owner' : 'Client'}
              </div>
            </div>
            <div className={styles.dashTile}>
              <div className={styles.tileLabel}>Status</div>
              <div className={styles.tileValueGreen}>Early access</div>
            </div>
            <div className={styles.dashTile}>
              <div className={styles.tileLabel}>Account</div>
              <div className={styles.tileValue}>
                {user.email_confirmed_at ? 'Verified' : 'Pending verification'}
              </div>
            </div>
          </div>

          <div className={styles.dashNote}>
            SwingBy is launching soon. You'll be notified at <strong>{user.email}</strong> the moment we go live.
          </div>

          <Link to="/" className={styles.backLink}>Back to home</Link>
        </div>
      </div>
    </div>
  )
}
