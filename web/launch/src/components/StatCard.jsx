import { ArrowUp, ArrowDown, Minus } from '@phosphor-icons/react'
import styles from './StatCard.module.css'

export default function StatCard({ label, value, delta, deltaLabel, icon: Icon, format = 'number' }) {
  const formatted = formatValue(value, format)
  const deltaPositive = delta > 0
  const deltaZero = delta === 0 || delta == null

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {Icon && <div className={styles.icon}><Icon size={20} weight="duotone" /></div>}
      </div>
      <div className={styles.value}>{formatted}</div>
      {!deltaZero && (
        <div className={[styles.delta, deltaPositive ? styles.up : styles.down].join(' ')}>
          {deltaPositive ? <ArrowUp size={14} weight="bold" /> : <ArrowDown size={14} weight="bold" />}
          <span>{Math.abs(delta)}%</span>
          {deltaLabel && <span className={styles.deltaLabel}>{deltaLabel}</span>}
        </div>
      )}
      {deltaZero && deltaLabel && (
        <div className={styles.delta}>
          <Minus size={14} />
          <span className={styles.deltaLabel}>{deltaLabel}</span>
        </div>
      )}
    </div>
  )
}

function formatValue(value, format) {
  if (value == null) return '—'
  switch (format) {
    case 'currency': return `$${Number(value).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'percent': return `${Number(value).toFixed(1)}%`
    case 'rating': return `${Number(value).toFixed(1)} ★`
    default: return Number(value).toLocaleString()
  }
}
