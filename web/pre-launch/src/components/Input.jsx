import { forwardRef, useState } from 'react'
import styles from './Input.module.css'

const Input = forwardRef(function Input(
  { label, error, helperText, prefix, suffix, className, ...props },
  ref
) {
  const [focused, setFocused] = useState(false)
  const hasValue = props.value !== undefined ? !!props.value : false
  const isActive = focused || hasValue

  return (
    <div className={`${styles.wrapper} ${error ? styles.error : ''} ${className || ''}`}>
      <div className={`${styles.inputWrap} ${isActive ? styles.active : ''}`}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <input
          ref={ref}
          className={styles.input}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
          placeholder=" "
          {...props}
        />
        {label && (
          <label className={styles.label}>{label}</label>
        )}
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
      {(error || helperText) && (
        <span className={styles.helper}>
          {error || helperText}
        </span>
      )}
    </div>
  )
})

export default Input
