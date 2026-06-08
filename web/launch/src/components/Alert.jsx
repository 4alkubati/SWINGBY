import { CheckCircle, Warning, XCircle, Info } from '@phosphor-icons/react'
import styles from './Alert.module.css'

const icons = { success: CheckCircle, warning: Warning, error: XCircle, info: Info }

export default function Alert({ type = 'info', children, className }) {
  const Icon = icons[type]
  return (
    <div className={[styles.alert, styles[type], className].filter(Boolean).join(' ')} role="alert">
      <Icon size={18} weight="fill" className={styles.icon} />
      <span>{children}</span>
    </div>
  )
}
