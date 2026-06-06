import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from './PageSkeleton'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageSkeleton />
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />

  return children
}

export function RoleProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageSkeleton />
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-4xl) var(--space-lg)' }}>
        <h1 className="heading-lg" style={{ marginBottom: 'var(--space-base)' }}>Access Denied</h1>
        <p className="body-lg" style={{ color: 'var(--color-text-secondary)' }}>
          You don't have permission to view this page.
        </p>
      </div>
    )
  }

  return children
}
