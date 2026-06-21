import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/services/api'
import { setToken, setUser, logout } from '@/services/auth'
import styles from './LoginPage.module.css'

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
    <div className={styles.page}>
      {/* Ambient glow orb */}
      <div className={styles.orb} aria-hidden="true" />

      <div className={styles.card}>
        <h1 className={styles.heading}>SwingBy Admin</h1>
        <p className={styles.subheading}>Sign in to the admin console</p>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              className={styles.input}
              id="email"
              type="email"
              placeholder="admin@swingbyy.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              className={styles.input}
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
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading && <span className={styles.spinner} aria-hidden="true" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
