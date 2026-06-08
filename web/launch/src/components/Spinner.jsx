import { CircleNotch } from '@phosphor-icons/react'
import styles from './Spinner.module.css'

export default function Spinner({ size = 24, label = 'Loading…' }) {
  return (
    <div className={styles.wrapper} role="status" aria-label={label}>
      <CircleNotch size={size} className={styles.spin} />
    </div>
  )
}
