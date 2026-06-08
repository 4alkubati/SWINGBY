import styles from './Dashboard.module.css'

export default function PaymentMethods() {
  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 className={styles.pageTitle}>Payment methods</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-md)', fontSize: '14px' }}>
        Payments are processed through Stripe at booking. Card management will be available once Stripe integration is live. For now, payment details are entered at checkout.
      </p>
    </div>
  )
}
