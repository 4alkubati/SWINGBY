import styles from './Card.module.css'

export default function Card({ children, className, elevated, ...props }) {
  return (
    <div
      className={[styles.card, elevated ? styles.elevated : '', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}
