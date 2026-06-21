import SEO from '../components/SEO'
import styles from './page.module.css'

export default function Careers() {
  return (
    <>
      <SEO title="Careers" description="Work at SwingBy — help us build the trust layer for local services in Calgary." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Join SwingBy</h1>
          <p className={styles.pageSubtitle}>We're building the trust layer for local services. Come build it with us.</p>
        </div>
        <div className={styles.section} style={{ maxWidth: '720px' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1.7, marginBottom: 'var(--space-xl)' }}>
            SwingBy is an early-stage company based in Calgary, Alberta. We're a small team with big ambitions. If you care about building things that work for real people — tradespeople, homeowners, small businesses — we'd love to hear from you.
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-base)' }}>Open roles</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', marginBottom: 'var(--space-xl)' }}>No open roles posted right now. We occasionally hire for full-stack engineering, product design, and growth. Email us with your background and what you'd want to work on.</p>
          <a href="mailto:careers@swingbyy.com" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--color-accent-btn)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '14px' }}>
            careers@swingbyy.com
          </a>
        </div>
      </div>
    </>
  )
}
