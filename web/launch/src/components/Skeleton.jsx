import styles from './Skeleton.module.css'

export default function Skeleton({ width, height, className }) {
  return (
    <div
      className={[styles.skeleton, className].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
