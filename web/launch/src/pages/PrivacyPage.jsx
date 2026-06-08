import SEO from '../components/SEO'
import styles from './page.module.css'

export default function PrivacyPage() {
  return (
    <>
      <SEO title="Privacy policy" noindex />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Privacy policy</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '8px' }}>Last updated: June 2026</p>
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto' }} className={styles.prose}>
          <h2>What we collect</h2>
          <p>We collect information you provide (name, email, phone, role) when you sign up, plus usage data (pages visited, actions taken) to improve the product. For businesses, we collect business name, category, service area, and license information you provide.</p>
          <h2>How we use it</h2>
          <p>We use your information to operate the platform, send transactional emails (booking confirmations, receipts, support replies), and improve our product. We do not sell your personal information to third parties.</p>
          <h2>Who sees what</h2>
          <p>Client names are not shared with businesses until a booking is confirmed. Business contact details are not shared with clients until a booking is confirmed. Reviews are public and tied to verified bookings.</p>
          <h2>Data storage</h2>
          <p>Data is stored on servers in Canada (Supabase, ca-central-1 region). We use Supabase Auth for authentication and Row Level Security to protect data access.</p>
          <h2>Your rights</h2>
          <p>Under PIPEDA, you have the right to access, correct, or request deletion of your personal information. Email privacy@swingby.ca to exercise these rights.</p>
          <h2>Cookies</h2>
          <p>We use essential cookies for authentication (session management). We use Plausible Analytics, which is cookie-free and privacy-compliant. See our <a href="/cookies" style={{ color: 'var(--color-accent-text)' }}>cookies page</a> for details.</p>
          <h2>Contact</h2>
          <p>Privacy questions: <a href="mailto:privacy@swingby.ca" style={{ color: 'var(--color-accent-text)' }}>privacy@swingby.ca</a></p>
        </div>
      </div>
    </>
  )
}
