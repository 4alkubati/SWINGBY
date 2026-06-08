import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  House, CalendarCheck, ChatCircle, UserCircle, Gear,
  ChartBar, CurrencyDollar, Export, Plugs, SignOut, List, X,
} from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { useUser } from '../hooks/useUser'
import styles from './DashboardLayout.module.css'

const CLIENT_NAV = [
  { to: '/app/dashboard', icon: House, label: 'Dashboard' },
  { to: '/app/bookings', icon: CalendarCheck, label: 'Bookings' },
  { to: '/app/messages', icon: ChatCircle, label: 'Messages' },
  { to: '/app/profile', icon: UserCircle, label: 'Profile' },
  { to: '/app/settings/account', icon: Gear, label: 'Settings' },
]

const BIZ_NAV = [
  { to: '/app/dashboard', icon: House, label: 'Dashboard' },
  { to: '/app/bookings', icon: CalendarCheck, label: 'Bookings' },
  { to: '/app/messages', icon: ChatCircle, label: 'Messages' },
  { to: '/app/business/analytics', icon: ChartBar, label: 'Analytics' },
  { to: '/app/business/earnings', icon: CurrencyDollar, label: 'Earnings' },
  { to: '/app/business/exports', icon: Export, label: 'Exports' },
  { to: '/app/business/integrations', icon: Plugs, label: 'Integrations' },
  { to: '/app/profile', icon: UserCircle, label: 'Profile' },
  { to: '/app/settings/account', icon: Gear, label: 'Settings' },
]

export default function DashboardLayout() {
  const { signOut } = useAuth()
  const { data: user } = useUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isBusiness = user?.role === 'business_owner'
  const nav = isBusiness ? BIZ_NAV : CLIENT_NAV

  return (
    <div className={styles.root}>
      {/* Sidebar */}
      <aside className={[styles.sidebar, sidebarOpen ? styles.open : ''].join(' ')}>
        <div className={styles.sidebarTop}>
          <Link to="/" className={styles.logo}>SwingBy</Link>
          <button className={styles.closeBtn} onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav} aria-label="Dashboard navigation">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app/dashboard'}
              className={({ isActive }) => [styles.navItem, isActive ? styles.active : ''].join(' ')}
            >
              <Icon size={20} weight="regular" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>{user?.first_name?.[0] || '?'}</div>
            <div>
              <p className={styles.userName}>{user?.first_name} {user?.last_name}</p>
              <p className={styles.userRole}>{isBusiness ? 'Business' : 'Client'}</p>
            </div>
          </div>
          <button onClick={signOut} className={styles.signOutBtn} aria-label="Sign out">
            <SignOut size={18} />
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Main area */}
      <div className={styles.content}>
        <header className={styles.topbar}>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <List size={22} />
          </button>
          <Link to="/" className={styles.topbarLogo}>SwingBy</Link>
        </header>

        <main id="main-content" className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
