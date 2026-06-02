import { useEffect, useMemo, useState } from 'react'
import api from '@/services/api'
import DataTable from '@/components/DataTable'
import styles from './UsersPage.module.css'

// ── Helpers ────────────────────────────────────────────────────────────────

function roleBadgeClass(role) {
  if (role === 'admin')    return 'badge badge-orange'
  if (role === 'business') return 'badge badge-blue'
  return 'badge badge-muted'
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return value
  }
}

function userInitials(user) {
  const name = user.name || user.full_name || user.email || '?'
  return name.split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
}

const ROLE_OPTIONS = [
  { value: 'all',      label: 'All Roles' },
  { value: 'client',   label: 'Client' },
  { value: 'business', label: 'Business' },
  { value: 'admin',    label: 'Admin' },
]

const SKELETON_ROWS = Array.from({ length: 8 }, (_, i) => i)

// ── Column definitions ──────────────────────────────────────────────────────

function buildColumns(onToggleSuspend) {
  return [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (val) => <span className="mono">{val}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (val, row) => (
        <span>{row.name || row.full_name || '—'}</span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (val) => <span>{val || '—'}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (val) => (
        <span className={roleBadgeClass(val)}>
          {val || 'client'}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: false,
      render: (val) => (
        val !== false
          ? <span className="badge badge-green">Active</span>
          : <span className="badge badge-red">Inactive</span>
      ),
    },
    {
      key: 'suspended',
      label: 'Suspended',
      sortable: false,
      render: (val, row) => (
        <label
          className="toggle"
          onClick={(e) => e.stopPropagation()}
          aria-label={`${val ? 'Unsuspend' : 'Suspend'} ${row.name || row.email}`}
        >
          <input
            type="checkbox"
            checked={!!val}
            onChange={() => onToggleSuspend(row)}
          />
          <span className="toggle-track" />
          <span className="toggle-thumb" />
        </label>
      ),
    },
  ]
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className={styles.skeletonBody}>
      {SKELETON_ROWS.map((i) => (
        <div key={i} className={styles.skeletonRow} style={{ animationDelay: `${i * 50}ms` }}>
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
          <div className={styles.skeletonCell} />
        </div>
      ))}
    </div>
  )
}

function UserDrawer({ user, onClose, onToggleSuspend }) {
  const isOpen = !!user
  const drawerRef = React.useRef(null)

  // Trap body scroll and focus when open; handle Escape
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Move focus to the drawer close button
      requestAnimationFrame(() => {
        const closeBtn = drawerRef.current?.querySelector('button[aria-label="Close"]')
        closeBtn?.focus()
      })
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Escape key + focus trap
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last  = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        ref={drawerRef}
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="User details"
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>User Details</span>
          <button
            className={styles.drawerClose}
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {user && (
          <div className={styles.drawerBody}>
            {/* Avatar + name */}
            <div className={styles.drawerAvatar}>
              <div className={styles.avatarCircle}>{userInitials(user)}</div>
              <div>
                <div className={styles.drawerName}>
                  {user.name || user.full_name || '—'}
                </div>
                <div className={styles.drawerEmail}>{user.email}</div>
              </div>
            </div>

            {/* Detail grid */}
            <div className={styles.detailGrid}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>ID</span>
                <span className={`${styles.detailValue} ${styles.monoValue}`}>{user.id}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Role</span>
                <span className={styles.detailValue}>
                  <span className={roleBadgeClass(user.role)}>
                    {user.role || 'client'}
                  </span>
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Status</span>
                <span className={styles.detailValue}>
                  {user.is_active !== false
                    ? <span className="badge badge-green">Active</span>
                    : <span className="badge badge-red">Inactive</span>}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Joined</span>
                <span className={styles.detailValue}>{formatDate(user.created_at || user.joined_at)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Last Active</span>
                <span className={styles.detailValue}>{formatDate(user.last_active_at || user.last_login_at)}</span>
              </div>
            </div>

            {/* Suspend toggle */}
            <div className={styles.drawerSection}>
              <div className={styles.drawerSectionHeader}>Account Control</div>
              <div className={styles.drawerSectionBody}>
                <div>
                  <div className={styles.drawerSectionLabel}>
                    {user.suspended ? 'Account suspended' : 'Account active'}
                  </div>
                  <div className={styles.drawerSectionSub}>
                    {user.suspended
                      ? 'User cannot sign in or use the platform.'
                      : 'User has full access to the platform.'}
                  </div>
                </div>
                <label
                  className="toggle"
                  aria-label={user.suspended ? 'Unsuspend user' : 'Suspend user'}
                >
                  <input
                    type="checkbox"
                    checked={!!user.suspended}
                    onChange={() => onToggleSuspend(user)}
                  />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)

  // Fetch users
  useEffect(() => {
    api.get('/admin/users')
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : res.data?.users ?? []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  // Sync drawer user with live users list (so toggle in drawer reflects immediately)
  useEffect(() => {
    if (!selectedUser) return
    const fresh = users.find((u) => u.id === selectedUser.id)
    if (fresh) setSelectedUser(fresh)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users])

  // Client-side filter
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      const name  = (u.name || u.full_name || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      const matchesSearch = !q || name.includes(q) || email.includes(q)
      const matchesRole   =
        roleFilter === 'all' ||
        (u.role || 'client').toLowerCase() === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  async function toggleSuspend(user) {
    try {
      await api.post(`/admin/suspend-user/${user.id}`, { suspended: !user.suspended })
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, suspended: !u.suspended } : u)
      )
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed')
    }
  }

  const columns = useMemo(() => buildColumns(toggleSuspend), [])

  return (
    <>
      {/* Page header */}
      <div className={`page-header ${styles.pageHeader}`}>
        <h1>Users</h1>
        <p>All registered users. Click a row for details. Toggle suspension to restrict account access.</p>
      </div>

      {/* Table card */}
      <div className={styles.card}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.searchWrap}>
              <svg
                className={styles.searchIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search users"
              />
            </div>
          </div>

          <div className={styles.toolbarRight}>
            <select
              className={styles.roleSelect}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {!loading && (
              <span className={styles.count}>
                {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
              </span>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && <SkeletonRows />}

        {/* Error state */}
        {!loading && error && (
          <div className={styles.stateError}>
            <div className={styles.stateErrorTitle}>Unable to load users</div>
            <div className={styles.stateErrorSub}>{error}</div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredUsers.length === 0 && (
          <div className={styles.stateEmpty}>
            <div className={styles.stateEmptyTitle}>
              {search || roleFilter !== 'all'
                ? 'No users match the current filters'
                : 'No users registered yet'}
            </div>
            <div className={styles.stateEmptySub}>
              {search || roleFilter !== 'all'
                ? 'Try a different search term or role filter.'
                : 'Users will appear here once they sign up on the platform.'}
            </div>
          </div>
        )}

        {/* Data table */}
        {!loading && !error && filteredUsers.length > 0 && (
          <DataTable
            columns={columns}
            data={filteredUsers}
            pageSize={15}
            onRowClick={(row) => setSelectedUser(row)}
            rowClassName={() => styles.clickableRow}
          />
        )}
      </div>

      {/* User detail drawer */}
      <UserDrawer
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onToggleSuspend={toggleSuspend}
      />
    </>
  )
}
