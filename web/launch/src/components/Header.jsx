import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { List, X } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import styles from './Header.module.css'

const NAV = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/for-businesses', label: 'For businesses' },
  { to: '/categories', label: 'Categories' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/help', label: 'Help' },
]

export default function Header() {
  const location = useLocation()
  const { session } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  return (
    <>
      <header className={[styles.header, scrolled ? styles.scrolled : ''].join(' ')}>
        <div className={styles.inner}>
          <Link to="/" className={styles.logo} aria-label="SwingBy home">SwingBy</Link>

          <nav className={styles.nav} aria-label="Main navigation">
            {NAV.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={[styles.navLink, location.pathname === link.to ? styles.active : ''].join(' ')}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            {session ? (
              <Link to="/app/dashboard" className={styles.ctaBtn}>Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className={styles.loginBtn}>Sign in</Link>
                <Link to="/signup" className={styles.ctaBtn}>Get started</Link>
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
          {NAV.map((link) => (
            <Link key={link.to} to={link.to} className={styles.mobileLink}>{link.label}</Link>
          ))}
          {session ? (
            <Link to="/app/dashboard" className={styles.mobileCta}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className={styles.mobileLink}>Sign in</Link>
              <Link to="/signup" className={styles.mobileCta}>Get started</Link>
            </>
          )}
        </nav>
      )}
    </>
  )
}
