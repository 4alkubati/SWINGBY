import { Check } from '@phosphor-icons/react'
import styles from './Checkbox.module.css'

export function Checkbox({ checked, onChange, label, disabled, className }) {
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ''} ${className || ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={styles.input}
      />
      <span className={`${styles.box} ${checked ? styles.checked : ''}`}>
        {checked && <Check size={12} weight="bold" />}
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  )
}

export function Radio({ checked, onChange, label, name, value, disabled, className }) {
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ''} ${className || ''}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        className={styles.input}
      />
      <span className={`${styles.radio} ${checked ? styles.radioChecked : ''}`}>
        {checked && <span className={styles.dot} />}
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  )
}
