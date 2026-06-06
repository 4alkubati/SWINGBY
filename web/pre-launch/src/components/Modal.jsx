import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import styles from './Modal.module.css'

export default function Modal({ open, onClose, title, children, className }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.portal}>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={`${styles.dialog} ${className || ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          >
            <div className={styles.header}>
              {title && <h2 className={styles.title}>{title}</h2>}
              <button ref={closeRef} className={styles.close} onClick={onClose} aria-label="Close">
                <X size={20} weight="bold" />
              </button>
            </div>
            <div className={styles.body}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
