import styles from './Avatar.module.css'

const SIZES = { 24: 24, 32: 32, 48: 48, 64: 64, 96: 96 }

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function Avatar({ src, name, size = 48, status, className }) {
  const px = SIZES[size] || size

  return (
    <div className={`${styles.avatar} ${className || ''}`} style={{ width: px, height: px }}>
      {src ? (
        <img src={src} alt={name || ''} className={styles.image} />
      ) : (
        <span className={styles.initials} style={{ fontSize: px * 0.38 }}>
          {getInitials(name)}
        </span>
      )}
      {status && (
        <span className={`${styles.status} ${styles[status]}`} />
      )}
    </div>
  )
}
