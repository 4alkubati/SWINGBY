import { useState, useEffect } from 'react'
import styles from './CookieBanner.module.css'

const STORAGE_KEY = 'swingby_cookies_accepted'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      // Slight delay so the page renders first
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setVisible(false)
  }

  function handleDecline() {
    localStorage.setItem(STORAGE_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={`${styles.banner} ${visible ? styles.bannerVisible : ''}`}
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-banner-desc"
    >
      <p id="cookie-banner-desc" className={styles.text}>
        <span className={styles.cookieIcon} aria-hidden="true">🍪</span>
        We use cookies to make SwingBy work and to learn what&apos;s useful. Read more in our{' '}
        <a href="/privacy" className={styles.link}>Privacy Policy</a>.
      </p>
      <div className={styles.actions}>
        <button className={styles.declineBtn} onClick={handleDecline}>Decline</button>
        <button className={styles.acceptBtn} onClick={handleAccept}>Accept</button>
      </div>
      <button
        className={styles.closeBtn}
        onClick={handleDecline}
        aria-label="Close cookie banner"
      >
        ×
      </button>
    </div>
  )
}
