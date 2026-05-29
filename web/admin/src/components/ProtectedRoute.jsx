import { Navigate } from 'react-router-dom'
import { getToken, isAdmin } from '@/services/auth'

export default function ProtectedRoute({ children }) {
  const token = getToken()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin()) {
    return <Navigate to="/login" replace />
  }

  return children
}
