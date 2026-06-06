import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './Tooltip.module.css'

export default function Tooltip({ content, children, delay = 400 }) {
  const [show, setShow] = useState(false)
  let timeout

  const handleEnter = () => {
    timeout = setTimeout(() => setShow(true), delay)
  }

  const handleLeave = () => {
    clearTimeout(timeout)
    setShow(false)
  }

  return (
    <div
      className={styles.wrapper}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            className={styles.tip}
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
