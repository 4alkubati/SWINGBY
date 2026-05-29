import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import styles from './LegalPage.module.css'

const LAST_UPDATED = 'May 2025'

const SECTIONS = [
  {
    title: '1. Use of the Platform',
    body: `By creating an account on SwingBy, you agree to use the platform only for lawful purposes. You must be at least 18 years old to create an account.

Clients ("users") may post service requests and accept quotes from service providers. Service providers ("businesses") may submit quotes and complete booked jobs through the platform.

You agree not to: misrepresent your identity or credentials, post fraudulent job listings or quotes, attempt to circumvent the platform's payment system, or engage in harassment or abusive behaviour toward other users.

SwingBy reserves the right to suspend or terminate accounts that violate these terms.`,
  },
  {
    title: '2. Payments, Escrow & Refunds',
    body: `All payments on SwingBy are processed through our payment partner. When a client accepts a quote, payment is held in escrow until the job is marked complete by the service provider and photo proof is submitted.

Payment is automatically released to the service provider upon job completion. In cases of dispute, SwingBy may hold payment pending investigation.

Refunds: if a job is cancelled before it begins, a full refund will be issued. If a dispute arises after work has started, SwingBy will review submitted evidence (photos, messages) and make a final determination.

SwingBy charges a platform fee on each completed transaction. This fee is disclosed at the time of booking.`,
  },
  {
    title: '3. Disclaimers & Limitation of Liability',
    body: `SwingBy is a marketplace that connects clients with independent service providers. We do not employ service providers, and we are not responsible for the quality, safety, legality, or completion of services performed.

We verify business licenses where indicated by a "Verified" badge, but verification does not constitute an endorsement or guarantee of service quality.

To the maximum extent permitted by law, SwingBy's liability for any claim arising from your use of the platform is limited to the amount you paid for the relevant transaction.

These terms are governed by the laws of Alberta, Canada, consistent with the Alberta Consumer Protection Act and applicable federal law. For questions, contact legal@swingbyy.com`,
  },
]

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>SwingBy</Link>
      </nav>

      <main className={styles.main}>
        <h1 className={styles.docTitle}>Terms of Service</h1>
        <p className={styles.docMeta}>Last updated: {LAST_UPDATED}</p>
        <p className={styles.docIntro}>
          Please read these Terms of Service carefully before using SwingBy. By accessing or using our platform, you agree to be bound by these terms.
        </p>

        {SECTIONS.map((section, i) => (
          <div className={styles.section} key={i}>
            <h2 className={styles.sectionHeading}>{section.title}</h2>
            <p className={styles.sectionBody}>{section.body}</p>
          </div>
        ))}

        <div className={styles.contactCard}>
          <p className={styles.contactTitle}>Legal questions?</p>
          <p className={styles.contactBody}>
            Email{' '}
            <a href="mailto:legal@swingbyy.com" className={styles.contactLink}>legal@swingbyy.com</a>
            {' '}or{' '}
            <a href="mailto:4alkubati@gmail.com" className={styles.contactLink}>4alkubati@gmail.com</a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
