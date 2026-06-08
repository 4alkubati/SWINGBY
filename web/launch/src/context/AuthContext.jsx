import { createContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        queryClient.clear()
      }
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      queryClient.clear()
      window.location.href = '/'
    }
  }, [queryClient])

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
