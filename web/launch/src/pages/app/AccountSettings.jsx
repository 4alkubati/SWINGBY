import { useAuth } from '../../hooks/useAuth'
import Button from '../../components/Button'
import styles from './Dashboard.module.css'

export default function AccountSettings() {
  const { signOut } = useAuth()
  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 className={styles.pageTitle}>Account settings</h1>
      <div style={{ marginTop: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--color-text-primary)', marginBottom: '8px' }}>Password</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Use the forgot-password flow to change your password.</p>
          <a href="/forgot-password" style={{ color: 'var(--color-accent-text)', fontSize: '14px' }}>Reset password →</a>
        </div>
        <div style={{ background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--color-danger)', marginBottom: '8px' }}>Sign out</h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Sign out on this device.</p>
          <Button variant="danger" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    </div>
  )
}
