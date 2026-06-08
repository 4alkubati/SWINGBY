import styles from './Dashboard.module.css'

export default function NotificationSettings() {
  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 className={styles.pageTitle}>Notification settings</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-md)' }}>Notification preferences will be configurable here once push notifications are enabled in a future release.</p>
    </div>
  )
}
