import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { House, CalendarBlank, ChatText, User, Heart, Bell, GearSix, List, X, Storefront, ChartLineUp, UsersThree, Briefcase } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import styles from './DashboardLayout.module.css'

const CLIENT_NAV = [
  { to: '/dashboard', icon: House, labelKey: 'nav.home' },
  { to: '/bookings', icon: CalendarBlank, label: 'Bookings' },
  { to: '/messages', icon: ChatText, label: 'Messages' },
  { to: '/favorites', icon: Heart, label: 'Favorites' },
  { to: '/reviews', icon: User, label: 'Reviews' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/account', icon: GearSix, label: 'Settings' },
]

const BUSINESS_NAV = [
  { to: '/business/dashboard', icon: House, labelKey: 'nav.home' },
  { to: '/business/services', icon: Briefcase, label: 'Services' },
  { to: '/business/employees', icon: UsersThree, label: 'Employees' },
  { to: '/business/earnings', icon: ChartLineUp, label: 'Earnings' },
  { to: '/messages', icon: ChatText, label: 'Messages' },
  { to: '/business/profile', icon: Storefront, label: 'Profile' },
  { to: '/account', icon: GearSix, label: 'Settings' },
]

export default function DashboardLayout({ children }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const nav = user?.role === 'business_owner' ? BUSINESS_NAV : CLIENT_NAV

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        <button className={styles.toggle} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <List size={20} /> : <X size={20} />}
        </button>
        <nav className={styles.nav}>
          {nav.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.to
            return (
              <Link key={item.to} to={item.to} className={`${styles.navItem} ${active ? styles.active : ''}`}>
                <Icon size={20} weight={active ? 'bold' : 'regular'} />
                {!collapsed && <span>{item.labelKey ? t(item.labelKey) : item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
