import SEO from '../components/SEO'
import styles from './page.module.css'

export default function TermsPage() {
  return (
    <>
      <SEO title="Terms of service" noindex />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Terms of service</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '8px' }}>Last updated: June 2026</p>
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto' }} className={styles.prose}>
          <h2>Acceptance</h2>
          <p>By using SwingBy, you agree to these terms. If you don't agree, don't use the platform.</p>
          <h2>The platform</h2>
          <p>SwingBy is a marketplace that connects clients with service businesses. We facilitate bookings and hold payments in escrow. We are not a party to the service agreement between clients and businesses.</p>
          <h2>User obligations</h2>
          <p>You must provide accurate information, be 18 or older, and use the platform for legitimate service bookings only. Businesses must comply with all applicable laws and maintain valid licenses.</p>
          <h2>Payments and fees</h2>
          <p>Clients pay the quoted price at booking. Funds are held in escrow and released per the payment schedule. Businesses pay a 10% platform fee (or 5% founder rate) on completed bookings. Cancellation fees apply per the cancellation policy.</p>
          <h2>Disputes</h2>
          <p>SwingBy may adjudicate disputes between clients and businesses. Our decision is final for amounts held in escrow. We are not liable for losses exceeding the amount held.</p>
          <h2>Limitation of liability</h2>
          <p>SwingBy's liability is limited to the transaction amount in dispute. We are not responsible for the quality of services provided by businesses on the platform.</p>
          <h2>Governing law</h2>
          <p>These terms are governed by the laws of Alberta, Canada.</p>
          <h2>Contact</h2>
          <p>Legal questions: <a href="mailto:legal@swingbyy.com" style={{ color: 'var(--color-accent-text)' }}>legal@swingbyy.com</a></p>
        </div>
      </div>
    </>
  )
}
