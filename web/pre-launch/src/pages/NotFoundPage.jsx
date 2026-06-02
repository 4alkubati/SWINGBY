import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.css'

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      {/* ── Background glow orbs ── */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>SwingBy</Link>
      </nav>

      {/* ── Main content ── */}
      <main className={styles.main}>
        <div className={styles.watermark}>404</div>

        <div className={styles.content}>
          <div className={styles.iconWrap}>
            <span className={styles.icon}>🧭</span>
          </div>

          <h1 className={styles.heading}>Page not found</h1>

          <p className={styles.body}>
            The page you're looking for doesn't exist or has been moved.
          </p>

          <Link to="/" className={styles.cta}>
            Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}
