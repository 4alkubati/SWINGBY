import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './Footer.module.css'

const COLUMNS = [
  {
    titleKey: 'footer.product',
    links: [
      { to: '/how-it-works', labelKey: 'nav.howItWorks' },
      { to: '/categories', labelKey: 'nav.categories' },
      { to: '/pricing', labelKey: 'nav.pricing' },
      { to: '/download', label: 'Download' },
      { to: '/safety', label: 'Safety' },
    ],
  },
  {
    titleKey: 'footer.company',
    links: [
      { to: '/about', labelKey: 'nav.about' },
      { to: '/careers', label: 'Careers' },
      { to: '/press', label: 'Press' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    titleKey: 'footer.resources',
    links: [
      { to: '/help', labelKey: 'nav.help' },
      { to: '/blog', labelKey: 'nav.blog' },
      { to: '/for-businesses', labelKey: 'nav.forBusinesses' },
      { to: '/cities', label: 'Cities' },
    ],
  },
  {
    titleKey: 'footer.legal',
    links: [
      { to: '/privacy', labelKey: 'legal.privacyTitle' },
      { to: '/terms', labelKey: 'legal.termsTitle' },
      { to: '/cookies', labelKey: 'legal.cookiesTitle' },
      { to: '/accessibility', labelKey: 'legal.accessibilityTitle' },
    ],
  },
  {
    titleKey: 'footer.social',
    links: [
      { href: 'https://instagram.com/swingbyy', label: 'Instagram' },
      { href: 'https://twitter.com/swingbyy', label: 'Twitter / X' },
      { href: 'https://tiktok.com/@swingbyyy', label: 'TikTok' },
    ],
  },
]

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>SwingBy</Link>
          <p className={styles.tagline}>
            {t('home.heroSubtitle')}
          </p>
        </div>

        <div className={styles.columns}>
          {COLUMNS.map((col) => (
            <div key={col.titleKey} className={styles.column}>
              <h3 className={styles.columnTitle}>{t(col.titleKey)}</h3>
              <ul className={styles.columnList} role="list">
                {col.links.map((link) => (
                  <li key={link.to || link.href}>
                    {link.href ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.columnLink}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.to} className={styles.columnLink}>
                        {link.labelKey ? t(link.labelKey) : link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.bottom}>
          <span className={styles.copyright}>
            &copy; {new Date().getFullYear()} {t('footer.copyright')}
          </span>
          <span className={styles.langPlaceholder}>
            {t('footer.language')}: English
          </span>
        </div>
      </div>
    </footer>
  )
}
