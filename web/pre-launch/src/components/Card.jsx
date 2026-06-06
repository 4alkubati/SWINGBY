import styles from './Card.module.css'

export default function Card({ image, title, meta, children, actions, onClick, className }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={`${styles.card} ${onClick ? styles.clickable : ''} ${className || ''}`}
      onClick={onClick}
    >
      {image && <div className={styles.imageSlot}>{image}</div>}
      <div className={styles.body}>
        {title && <h3 className={styles.title}>{title}</h3>}
        {meta && <div className={styles.meta}>{meta}</div>}
        {children && <div className={styles.content}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </Tag>
  )
}
