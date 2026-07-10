import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { List, X, CaretDown } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import styles from './Header.module.css'

const NAV_PRIMARY = [
  {
    label: 'How it works',
    children: [
      { to: '/how-it-works/clients', label: 'For clients' },
      { to: '/how-it-works/businesses', label: 'For businesses' },
    ],
  },
  { to: '/pricing', label: 'Pricing' },
  { to: '/categories', label: 'Categories' },
  { to: '/calgary', label: 'Calgary' },
  { to: '/about', label: 'About' },
  { to: '/help', label: 'Help' },
]

const MOBILE_FLAT = [
  { to: '/how-it-works/clients', label: 'How it works — Clients' },
  { to: '/how-it-works/businesses', label: 'How it works — Businesses' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/categories', label: 'Categories' },
  { to: '/calgary', label: 'Calgary' },
  { to: '/about', label: 'About' },
  { to: '/help', label: 'Help' },
  { to: '/contact', label: 'Contact' },
]

function readAudience() {
  if (typeof window === 'undefined') return 'client'
  try { return window.localStorage.getItem('swingby_audience') || 'client' } catch { return 'client' }
}

export default function Header() {
  const location = useLocation()
  const { session } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const [audience, setAudience] = useState(readAudience)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false); setOpenMenu(null) }, [location.pathname])

  useEffect(() => {
    try { window.localStorage.setItem('swingby_audience', audience) } catch { /* noop */ }
  }, [audience])

  const primaryCta = audience === 'business'
    ? { to: '/signup?role=business', label: 'Get more jobs' }
    : { to: '/signup', label: "Post a job — it's free" }

  return (
    <>
      <header className={[styles.header, scrolled ? styles.scrolled : ''].join(' ')}>
        <div className={styles.inner}>
          <Link to="/" className={styles.logo} aria-label="SwingBy home">
            Swing<span className={styles.logoAccent}>By</span>
          </Link>

          <nav className={styles.nav} aria-label="Main navigation">
            {NAV_PRIMARY.map((item) => {
              if (item.children) {
                const isOpen = openMenu === item.label
                return (
                  <div
                    key={item.label}
                    className={styles.menuWrap}
                    onMouseEnter={() => setOpenMenu(item.label)}
                    onMouseLeave={() => setOpenMenu(null)}
                  >
                    <button
                      type="button"
                      className={styles.navLink}
                      aria-haspopup="menu"
                      aria-expanded={isOpen}
                      onClick={() => setOpenMenu(isOpen ? null : item.label)}
                    >
                      {item.label} <CaretDown size={12} weight="bold" />
                    </button>
                    {isOpen && (
                      <div className={styles.menuPanel} role="menu">
                        {item.children.map((c) => (
                          <Link key={c.to} to={c.to} className={styles.menuItem} role="menuitem">
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[styles.navLink, location.pathname === item.to ? styles.active : ''].join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className={styles.actions}>
            {session ? (
              <Link to="/app/dashboard" className={styles.ctaBtn}>Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className={styles.loginBtn}>Log in</Link>
                <Link to={primaryCta.to} className={styles.ctaBtn}>{primaryCta.label}</Link>
              </>
            )}
          </div>

          <button
            className={styles.hamburger}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={24} weight="bold" /> : <List size={24} weight="bold" />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <nav className={styles.mobileMenu} aria-label="Mobile navigation">
          <div className={styles.audienceToggle} role="tablist" aria-label="Choose audience">
            <button
              role="tab"
              aria-selected={audience === 'client'}
              className={[styles.audienceTab, audience === 'client' ? styles.audienceActive : ''].join(' ')}
              onClick={() => setAudience('client')}
              type="button"
            >
              I'm a client
            </button>
            <button
              role="tab"
              aria-selected={audience === 'business'}
              className={[styles.audienceTab, audience === 'business' ? styles.audienceActive : ''].join(' ')}
              onClick={() => setAudience('business')}
              type="button"
            >
              I'm a business owner
            </button>
          </div>

          {MOBILE_FLAT.map((link) => (
            <Link key={link.to} to={link.to} className={styles.mobileLink}>{link.label}</Link>
          ))}

          {session ? (
            <Link to="/app/dashboard" className={styles.mobileCta}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className={styles.mobileLink}>Log in</Link>
              <Link to={primaryCta.to} className={styles.mobileCta}>{primaryCta.label}</Link>
            </>
          )}
        </nav>
      )}
    </>
  )
}
