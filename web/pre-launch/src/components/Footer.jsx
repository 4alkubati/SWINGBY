import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.logo}>SwingBy</span>
      <span className={styles.copy}>
        {'© 2026 Swingbyy Inc. · '}
        <Link to="/privacy" className={styles.link}>Privacy</Link>
        {' · '}
        <Link to="/terms" className={styles.link}>Terms</Link>
        {' · '}
        <a href="mailto:4alkubati@gmail.com" className={styles.link}>Contact</a>
      </span>
    </footer>
  )
}
