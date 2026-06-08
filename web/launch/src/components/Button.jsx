import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { CircleNotch } from '@phosphor-icons/react'
import styles from './Button.module.css'

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading, disabled, icon, children, className, ...props },
  ref
) {
  return (
    <motion.button
      ref={ref}
      className={[styles.btn, styles[variant], styles[size], className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      {...props}
    >
      {loading ? (
        <CircleNotch size={size === 'sm' ? 14 : 18} className={styles.spinner} weight="bold" />
      ) : icon ? (
        <span className={styles.icon}>{icon}</span>
      ) : null}
      {children}
    </motion.button>
  )
})

export default Button
