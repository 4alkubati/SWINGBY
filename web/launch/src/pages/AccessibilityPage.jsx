import SEO from '../components/SEO'
import styles from './page.module.css'

export default function AccessibilityPage() {
  return (
    <>
      <SEO title="Accessibility" noindex />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Accessibility</h1>
        </div>
        <div style={{ maxWidth: '720px', margin: '0 auto' }} className={styles.prose}>
          <h2>Our commitment</h2>
          <p>SwingBy is committed to making our platform accessible to everyone, including people with disabilities. We aim for WCAG 2.1 AA compliance across all pages.</p>
          <h2>What we've implemented</h2>
          <ul>
            <li>Semantic HTML elements and correct heading hierarchy</li>
            <li>ARIA labels on interactive elements where needed</li>
            <li>Keyboard navigation throughout the site</li>
            <li>Focus indicators visible on all interactive elements</li>
            <li>Colour contrast ratios that meet WCAG AA minimums</li>
            <li>Skip-to-content link at the top of every page</li>
            <li>Alt text on all meaningful images</li>
          </ul>
          <h2>Known gaps</h2>
          <p>We are continuously improving. Known areas of work: improving ARIA live regions on dynamic content, enhancing screen reader experience in the messaging UI.</p>
          <h2>Feedback</h2>
          <p>If you encounter an accessibility barrier, email <a href="mailto:accessibility@swingby.ca" style={{ color: 'var(--color-accent-text)' }}>accessibility@swingby.ca</a>. We aim to respond within 5 business days.</p>
        </div>
      </div>
    </>
  )
}
