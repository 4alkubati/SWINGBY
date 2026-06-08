import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuth } from './useAuth'

export function useUser() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
  })
}
