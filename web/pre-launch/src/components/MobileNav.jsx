import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './MobileNav.module.css'

export default function MobileNav({ open, onClose, links }) {
  const { t } = useTranslation()
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.nav
            className={styles.drawer}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <button
              ref={closeRef}
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={24} weight="bold" />
            </button>

            <div className={styles.links}>
              {links.map((link) => (
                <Link key={link.key} to={link.to} className={styles.link} onClick={onClose}>
                  {t(link.label)}
                </Link>
              ))}
            </div>

            <div className={styles.actions}>
              <Link to="/login" className={styles.loginBtn} onClick={onClose}>
                {t('common.login')}
              </Link>
              <Link to="/signup" className={styles.ctaBtn} onClick={onClose}>
                {t('common.getStarted')}
              </Link>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  )
}
