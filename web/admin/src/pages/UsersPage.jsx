import { useEffect, useState } from 'react'
import api from '@/services/api'

export default function UsersPage() {
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.get('/admin/users')
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : res.data?.users ?? []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  async function toggleSuspend(user) {
    const endpoint = `/admin/suspend-user/${user.id}`
    try {
      await api.post(endpoint, { suspended: !user.suspended })
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, suspended: !u.suspended } : u)
      )
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed')
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Users</h1>
        <p>All registered users. Toggle suspension to restrict account access.</p>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>Users</strong>
            {!loading && <span className="count">{users.length} total</span>}
          </span>
        </div>

        {loading && <div className="state-loading">Loading users…</div>}
        {error   && <div className="state-empty" style={{ color: 'var(--red)' }}>{error}</div>}

        {!loading && !error && users.length === 0 && (
          <div className="state-empty">No users found.</div>
        )}

        {!loading && !error && users.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Suspended</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="mono">{user.id}</td>
                  <td>{user.name || user.full_name || '—'}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={
                      user.role === 'admin'    ? 'badge badge-orange' :
                      user.role === 'business' ? 'badge badge-blue'   :
                      'badge badge-muted'
                    }>
                      {user.role || 'client'}
                    </span>
                  </td>
                  <td>
                    <span className={user.is_active !== false ? 'badge badge-green' : 'badge badge-red'}>
                      {user.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={!!user.suspended}
                        onChange={() => toggleSuspend(user)}
                      />
                      <span className="toggle-track"></span>
                      <span className="toggle-thumb"></span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
