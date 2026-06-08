import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUser } from '../hooks/useUser'
import Spinner from './Spinner'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return children
}

export function RoleRoute({ children, allowedRoles }) {
  const { session, loading } = useAuth()
  const { data: user, isLoading } = useUser()
  const location = useLocation()

  if (loading || isLoading) return <Spinner />
  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/app/dashboard" replace />
  }
  return children
}
