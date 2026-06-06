import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { List } from '@phosphor-icons/react'
import MobileNav from './MobileNav'
import styles from './Header.module.css'

const NAV_LINKS = [
  { key: 'home', to: '/', label: 'nav.home' },
  { key: 'howItWorks', to: '/how-it-works', label: 'nav.howItWorks' },
  { key: 'forBusinesses', to: '/for-businesses', label: 'nav.forBusinesses' },
  { key: 'categories', to: '/categories', label: 'nav.categories' },
  { key: 'pricing', to: '/pricing', label: 'nav.pricing' },
  { key: 'help', to: '/help', label: 'nav.help' },
]

export default function Header() {
  const { t } = useTranslation()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.inner}>
          <Link to="/" className={styles.logo} aria-label="SwingBy home">
            SwingBy
          </Link>

          <nav className={styles.nav} aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                className={`${styles.navLink} ${location.pathname === link.to ? styles.active : ''}`}
              >
                {t(link.label)}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            <Link to="/login" className={styles.loginBtn}>
              {t('common.login')}
            </Link>
            <Link to="/signup" className={styles.ctaBtn}>
              {t('common.getStarted')}
            </Link>
          </div>

          <button
            className={styles.hamburger}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <List size={24} weight="bold" />
          </button>
        </div>
      </header>

      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={NAV_LINKS}
      />
    </>
  )
}
