import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  House,
  Users,
  Buildings,
  CalendarCheck,
  ClockCounterClockwise,
  SignOut,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react'
import { logout, getUser } from '@/services/auth'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard', Icon: House },
  { to: '/users',      label: 'Users',     Icon: Users },
  { to: '/businesses', label: 'Businesses',Icon: Buildings },
  { to: '/bookings',   label: 'Bookings',  Icon: CalendarCheck },
  { to: '/audit-log',  label: 'Audit Log', Icon: ClockCounterClockwise },
]

function getInitials(email) {
  if (!email) return 'A'
  const [local] = email.split('@')
  const parts = local.split(/[._-]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export default function Sidebar() {
  const navigate = useNavigate()
  const user = getUser()
  const [collapsed, setCollapsed] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = getInitials(user?.email)

  return (
    <aside className={`${styles.sidebar}${collapsed ? ` ${styles.collapsed}` : ''}`}>

      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoMark}>S</span>
        <span className={styles.logoText}>wing<em>By</em></span>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `${styles.navItem}${isActive ? ` ${styles.active}` : ''}`
            }
          >
            <span className={styles.navIcon} aria-hidden="true">
              <Icon size={20} />
            </span>
            <span className={styles.navLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Profile */}
      <div className={styles.profileMenu}>
        <span className={styles.avatar} aria-hidden="true">{initials}</span>
        <span className={styles.profileEmail}>{user?.email ?? 'Admin'}</span>
        <button
          className={styles.signOutBtn}
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
        >
          <SignOut size={18} />
        </button>
      </div>

      {/* Toggle */}
      <button
        className={styles.toggle}
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <CaretRight size={16} /> : <CaretLeft size={16} />}
      </button>

    </aside>
  )
}
