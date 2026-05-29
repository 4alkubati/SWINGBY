import { NavLink, useNavigate } from 'react-router-dom'
import { logout, getUser } from '@/services/auth'

const NAV_ITEMS = [
  { to: '/',            label: 'Dashboard',   icon: '▣' },
  { to: '/users',       label: 'Users',       icon: '◉' },
  { to: '/businesses',  label: 'Businesses',  icon: '⬡' },
  { to: '/bookings',    label: 'Bookings',    icon: '◈' },
  { to: '/audit-log',   label: 'Audit Log',   icon: '≡' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const user = getUser()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span>Swing<em>By</em></span>
        <div style={{ fontSize: 10, color: 'var(--text-ghost)', marginTop: 2, letterSpacing: 1 }}>
          ADMIN CONSOLE
        </div>
      </div>

      <p className="sidebar-label">Navigation</p>

      <ul className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span className="nav-icon" aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        {user && (
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            {user.email}
          </div>
        )}
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%' }}
          onClick={handleLogout}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
