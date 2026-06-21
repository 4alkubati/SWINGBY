import SEO from '../components/SEO'
import styles from './page.module.css'

export default function Press() {
  return (
    <>
      <SEO title="Press" description="SwingBy press kit and media contact. Launching in Calgary, Alberta." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Press</h1>
          <p className={styles.pageSubtitle}>Media inquiries and press resources.</p>
        </div>
        <div className={styles.prose} style={{ maxWidth: '720px' }}>
          <h2>About SwingBy</h2>
          <p>SwingBy is a Calgary-based marketplace connecting homeowners and renters with vetted local service businesses. Clients post jobs, businesses quote, and payments are held safely in escrow. Founded in 2026 and currently serving Calgary, Alberta.</p>
          <h2>Media contact</h2>
          <p><a href="mailto:press@swingbyy.com" style={{ color: 'var(--color-accent-text)' }}>press@swingbyy.com</a> — we respond within 24 hours on business days.</p>
          <h2>Press kit</h2>
          <p>Logo files, screenshots, and founder bio are available on request. Email us at press@swingbyy.com.</p>
        </div>
      </div>
    </>
  )
}
