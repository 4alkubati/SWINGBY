import SEO from '../components/SEO'
import styles from './page.module.css'

export default function PrivacyPage() {
  return (
    <>
      <SEO title="Privacy policy" />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Privacy policy</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '8px' }}>Last updated: July 2026</p>
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto' }} className={styles.prose}>
          <p>This is a plain-language summary. SwingBy is governed by Canada's PIPEDA and Alberta's PIPA.</p>
          <h2>What we collect</h2>
          <p>We collect information you provide (name, email, phone, role) when you sign up, plus usage data (pages visited, actions taken) to improve the product. For businesses, we collect business name, category, address, service area, and license information you provide. We also collect messages, reviews, disputes, referrals, account credits, and push-notification tokens as you use the platform.</p>
          <h2>How we use it</h2>
          <p>We use your information to operate the platform, send transactional emails (booking confirmations, receipts, support replies), and improve our product. We do not sell your personal information to third parties.</p>
          <h2>Who sees what</h2>
          <p>Before you accept a business, it sees only your first name, your job details, and an approximate (city-level) location — not your last name or street address. Those unlock for the business only once you accept and a booking is created. Reviews are public and tied to completed bookings.</p>
          <h2>Data storage and transfers</h2>
          <p>Personal data is stored in Canada (Supabase, ca-central-1). Our API is hosted in the United States, so data transits the US before it is stored. Some subprocessors (Stripe, Google, Sentry, Expo, Resend, Cloudflare) also process data outside Canada.</p>
          <h2>Retention</h2>
          <p>We keep booking and payment records for 6 years from the end of the tax year they relate to, as Canadian tax law requires, even after you delete your account.</p>
          <h2>Your rights and deletion</h2>
          <p>Under PIPEDA and Alberta PIPA you can access, correct, export, or delete your personal information. Deleting your account scrubs your personal identifiers; financial records we are legally required to keep are retained in de-identified form. Email privacy@swingbyy.com to exercise these rights.</p>
          <h2>Cookies</h2>
          <p>We use essential cookies for authentication (session management). We use Plausible Analytics, which is cookie-free. See our <a href="/cookies" style={{ color: 'var(--color-accent-text)' }}>cookies page</a> for details.</p>
          <h2>Contact</h2>
          <p>Privacy questions: <a href="mailto:privacy@swingbyy.com" style={{ color: 'var(--color-accent-text)' }}>privacy@swingbyy.com</a></p>
        </div>
      </div>
    </>
  )
}
