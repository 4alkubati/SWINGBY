import { Link } from 'react-router-dom'
import styles from './Dashboard.module.css'

export default function PrivacySettings() {
  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 className={styles.pageTitle}>Privacy</h1>
      <div style={{ marginTop: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>To request deletion of your data or exercise your PIPEDA rights, email <a href="mailto:privacy@swingbyy.com" style={{ color: 'var(--color-accent-text)' }}>privacy@swingbyy.com</a>.</p>
        <Link to="/privacy" style={{ color: 'var(--color-accent-text)', fontSize: '14px' }}>View full privacy policy →</Link>
      </div>
    </div>
  )
}
