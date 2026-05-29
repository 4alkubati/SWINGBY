import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import styles from './LegalPage.module.css'

const LAST_UPDATED = 'May 2025'

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: `When you use SwingBy, we collect information you provide directly to us, such as when you create an account, post a job, send a message, or contact support.

This includes: name, email address, phone number, location data (for matching you with nearby service providers), payment information (processed securely via our payment partner), and photos you upload as part of a job post or proof of work.

We also automatically collect certain usage data, including device identifiers, app interaction logs, and IP address.

SwingBy complies with the Personal Information Protection and Electronic Documents Act (PIPEDA) and Alberta's Personal Information Protection Act (PIPA).`,
  },
  {
    title: '2. How We Use Your Information',
    body: `We use the information we collect to:

• Operate and improve the SwingBy platform
• Match clients with service providers in their area
• Process payments and protect both parties through escrow
• Send you booking confirmations, status updates, and service notifications
• Respond to your questions and support requests
• Detect and prevent fraud or abuse

We do not sell your personal information to third parties. We may share limited data with service providers who help us operate the platform (e.g., payment processors, push notification services).`,
  },
  {
    title: '3. Your Rights & Data Retention',
    body: `You have the right to access, correct, or delete your personal data at any time. You can export your data directly from Settings → Export my data. To delete your account and all associated data, go to Settings → Delete my account.

We retain your data for as long as your account is active, or as required by applicable law. Upon account deletion, we purge personally identifiable information within 30 days, except where retention is legally required.

For privacy questions or requests, contact us at: privacy@swingbyy.com

This policy may be updated periodically. We will notify you of material changes through the app.`,
  },
]

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>SwingBy</Link>
      </nav>

      <main className={styles.main}>
        <h1 className={styles.docTitle}>Privacy Policy</h1>
        <p className={styles.docMeta}>Last updated: {LAST_UPDATED}</p>
        <p className={styles.docIntro}>
          SwingBy ("we", "us", "our") is committed to protecting your privacy. This policy explains how we collect, use, and protect your personal information when you use our app or website.
        </p>

        {SECTIONS.map((section, i) => (
          <div className={styles.section} key={i}>
            <h2 className={styles.sectionHeading}>{section.title}</h2>
            <p className={styles.sectionBody}>{section.body}</p>
          </div>
        ))}

        <div className={styles.contactCard}>
          <p className={styles.contactTitle}>Questions?</p>
          <p className={styles.contactBody}>
            Email us at{' '}
            <a href="mailto:privacy@swingbyy.com" className={styles.contactLink}>privacy@swingbyy.com</a>
            {' '}or{' '}
            <a href="mailto:4alkubati@gmail.com" className={styles.contactLink}>4alkubati@gmail.com</a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
