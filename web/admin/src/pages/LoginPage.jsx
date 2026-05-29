import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/services/api'
import { setToken, setUser, logout } from '@/services/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Step 1 — authenticate
      const loginRes = await api.post('/auth/login', { email, password })
      const token = loginRes.data?.access_token || loginRes.data?.token
      if (!token) throw new Error('No token returned')
      setToken(token)

      // Step 2 — verify admin role
      const meRes = await api.get('/auth/me')
      const user  = meRes.data

      if (user?.role !== 'admin') {
        logout()
        setError('Admin access required. Your account does not have admin privileges.')
        setLoading(false)
        return
      }

      setUser(user)
      navigate('/')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Login failed'
      setError(msg)
      logout()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>SwingBy Admin</h1>
        <p className="sub">Sign in to the admin console</p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="admin@swingby.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>
      </div>
    </div>
  )
}
