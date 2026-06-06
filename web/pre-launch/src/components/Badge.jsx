import styles from './Badge.module.css'

export default function Badge({ variant = 'neutral', children, className }) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className || ''}`}>
      {children}
    </span>
  )
}
