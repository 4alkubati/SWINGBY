import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import styles from './Layout.module.css'

export default function Layout({ noFooter }) {
  return (
    <div className={styles.root}>
      <Header />
      <main id="main-content" className={styles.main}>
        <Outlet />
      </main>
      {!noFooter && <Footer />}
    </div>
  )
}
