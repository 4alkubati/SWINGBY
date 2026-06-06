import { Link } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import styles from './Breadcrumbs.module.css'

export default function Breadcrumbs({ items, className }) {
  return (
    <nav aria-label="Breadcrumb" className={`${styles.nav} ${className || ''}`}>
      <ol className={styles.list}>
        {items.map((item, i) => (
          <li key={i} className={styles.item}>
            {i > 0 && <CaretRight size={12} className={styles.separator} />}
            {item.to ? (
              <Link to={item.to} className={styles.link}>{item.label}</Link>
            ) : (
              <span className={styles.current} aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
