import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

const COLS = [
  {
    heading: 'Product',
    links: [
      { to: '/how-it-works/clients', label: 'How it works' },
      { to: '/for-clients', label: 'For clients' },
      { to: '/for-businesses', label: 'For businesses' },
      { to: '/pricing', label: 'Pricing' },
      { to: '/safety', label: 'Safety' },
    ],
  },
  {
    heading: 'Discover',
    links: [
      { to: '/categories', label: 'All categories' },
      { to: '/calgary', label: 'Calgary' },
      { to: '/blog', label: 'Blog' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/careers', label: 'Careers' },
      { to: '/press', label: 'Press' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
      { to: '/cookies', label: 'Cookies' },
      { to: '/accessibility', label: 'Accessibility' },
    ],
  },
]

const SOCIAL = [
  { href: 'https://instagram.com/swingbyy', label: 'Instagram' },
  { href: 'https://twitter.com/swingbyy', label: 'Twitter / X' },
  { href: 'https://tiktok.com/@swingbyyy', label: 'TikTok' },
]

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>Swing<span className={styles.logoAccent}>By</span></Link>
          <p className={styles.tagline}>The trust layer for local services.</p>
          <p className={styles.location}>Based in Calgary, Alberta.</p>
        </div>
        <div className={styles.cols}>
          {COLS.map((col) => (
            <div key={col.heading} className={styles.col}>
              <h3 className={styles.colHeading}>{col.heading}</h3>
              <ul>
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className={styles.colLink}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className={styles.col}>
            <h3 className={styles.colHeading}>Follow</h3>
            <ul>
              {SOCIAL.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className={styles.colLink}>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className={styles.bottom}>
        <p className={styles.copy}>&copy; {new Date().getFullYear()} SwingBy Technologies Inc. · Built in Calgary, Canada</p>
        <p className={styles.casl}>Respecting Canada's Anti-Spam Legislation (CASL).</p>
      </div>
    </footer>
  )
}
