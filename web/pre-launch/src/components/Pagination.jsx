import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import styles from './Pagination.module.css'

export default function Pagination({ page, totalPages, onChange, className }) {
  if (totalPages <= 1) return null

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <nav aria-label="Pagination" className={`${styles.nav} ${className || ''}`}>
      <button
        className={styles.arrow}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <CaretLeft size={16} />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className={styles.dots}>...</span>
        ) : (
          <button
            key={p}
            className={`${styles.page} ${p === page ? styles.active : ''}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        className={styles.arrow}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <CaretRight size={16} />
      </button>
    </nav>
  )
}
