import { forwardRef } from 'react'
import styles from './Input.module.css'

const Input = forwardRef(function Input({ label, error, hint, className, ...props }, ref) {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <input
        ref={ref}
        className={[styles.input, error ? styles.error : '', className].filter(Boolean).join(' ')}
        {...props}
      />
      {error && <p className={styles.errorMsg} role="alert">{error}</p>}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  )
})

export default Input
