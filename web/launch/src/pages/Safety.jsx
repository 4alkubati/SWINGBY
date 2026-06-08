import SEO from '../components/SEO'
import styles from './page.module.css'

export default function Safety() {
  return (
    <>
      <SEO title="Safety" description="How SwingBy protects clients and businesses — escrow payments, vetted listings, dispute resolution." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Built for trust</h1>
          <p className={styles.pageSubtitle}>Safety is not a feature — it's the foundation of how SwingBy works.</p>
        </div>
        <div className={styles.section}>
          <div className={styles.grid2}>
            {[
              { title: 'Escrow-protected payments', desc: 'Your payment is held securely when you book. 50% releases to the business on confirmation, the rest on completion. The business never has your money until the job is done.' },
              { title: 'Vetted business listings', desc: 'Every business goes through identity and license verification before listing. Ongoing review monitoring flags issues automatically.' },
              { title: 'Dispute resolution', desc: 'If something goes wrong, open a dispute in the app. SwingBy support reviews and resolves within 72 hours. Funds can be held until resolved.' },
              { title: 'No contact before booking', desc: 'Businesses express interest without seeing your contact details. You choose who to accept. No cold messages, no pressure.' },
              { title: 'Verified reviews only', desc: 'Reviews are tied to confirmed, completed bookings. You cannot review someone you never hired. Businesses cannot suppress feedback.' },
              { title: 'Data protection', desc: 'Your data is stored on Canadian servers. We follow PIPEDA and never sell personal data. See our privacy policy for full details.' },
            ].map(({ title, desc }) => (
              <div key={title} className={styles.card}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
