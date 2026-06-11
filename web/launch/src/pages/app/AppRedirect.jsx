import { Navigate } from 'react-router-dom'
import { useUser } from '../../hooks/useUser'
import Spinner from '../../components/Spinner'

export default function AppRedirect() {
  const { isLoading } = useUser()
  if (isLoading) return <Spinner />
  return <Navigate to="/app/dashboard" replace />
}
