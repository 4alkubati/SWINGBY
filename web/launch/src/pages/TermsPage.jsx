import SEO from '../components/SEO'
import styles from './page.module.css'

export default function TermsPage() {
  return (
    <>
      <SEO title="Terms of service" />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Terms of service</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '8px' }}>Last updated: July 2026</p>
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto' }} className={styles.prose}>
          <p>This is a plain-language summary. The full Terms of Service govern your use of SwingBy.</p>
          <h2>Acceptance</h2>
          <p>By using SwingBy, you agree to these terms. If you don't agree, don't use the platform.</p>
          <h2>The platform</h2>
          <p>SwingBy is a marketplace that connects clients with service businesses. We facilitate bookings and hold payments in escrow. We are not a party to the service agreement between clients and businesses.</p>
          <h2>User obligations</h2>
          <p>You must provide accurate information, be 18 or older, and use the platform for legitimate service bookings only. Businesses must comply with all applicable laws and maintain valid licenses.</p>
          <h2>Payments and fees</h2>
          <p>SwingBy is pay-upfront: the client is charged the full booking amount when the booking is created (at posting for a priced job, or at acceptance for a direct booking) and the funds are held in escrow. On completion, the business receives the booking amount less SwingBy's 10% platform fee. Nothing is released to the business before completion. Cancellation refunds and penalties follow the cancellation ladder in the full terms.</p>
          <h2>Disputes</h2>
          <p>Either party can open a dispute in the app. SwingBy reviews the evidence and its determination is final for the funds SwingBy holds. This is not arbitration and does not remove your other legal remedies.</p>
          <h2>Limitation of liability</h2>
          <p>To the maximum extent permitted by law, SwingBy's total liability is capped at the greater of CAD $100 or the fees you paid SwingBy in the 6 months before the claim. We are not responsible for the quality of services provided by businesses on the platform. Nothing here waives rights you have under Alberta's Consumer Protection Act.</p>
          <h2>Governing law</h2>
          <p>These terms are governed by the laws of Alberta, Canada.</p>
          <h2>Contact</h2>
          <p>Legal questions: <a href="mailto:legal@swingbyy.com" style={{ color: 'var(--color-accent-text)' }}>legal@swingbyy.com</a></p>
        </div>
      </div>
    </>
  )
}
