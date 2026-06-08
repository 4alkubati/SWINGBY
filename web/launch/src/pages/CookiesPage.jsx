import SEO from '../components/SEO'
import styles from './page.module.css'

export default function CookiesPage() {
  return (
    <>
      <SEO title="Cookie policy" noindex />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Cookie policy</h1>
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto' }} className={styles.prose}>
          <h2>What are cookies?</h2>
          <p>Cookies are small files stored by your browser. We use them minimally and only for necessary purposes.</p>
          <h2>Cookies we use</h2>
          <ul>
            <li><strong>Session cookies (essential)</strong> — Used by Supabase Auth to keep you signed in. These are strictly necessary and cannot be disabled.</li>
          </ul>
          <h2>Analytics</h2>
          <p>We use <strong>Plausible Analytics</strong> — a privacy-first analytics provider that does not use cookies and does not collect personal data. No consent is needed for Plausible.</p>
          <h2>No third-party ad cookies</h2>
          <p>We do not use advertising cookies, tracking pixels, or any third-party cookies for ad targeting.</p>
          <h2>Your choices</h2>
          <p>You can clear cookies in your browser settings. Removing session cookies will sign you out of SwingBy.</p>
        </div>
      </div>
    </>
  )
}
