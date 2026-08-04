import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Start "not loading" when there is no auth backend to wait for, otherwise
  // anything gated on `loading` would spin forever on a build without Supabase.
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    // No Supabase in this build: stay logged out and mount cleanly.
    //
    // This provider wraps the whole app, so anything that throws here blanks the
    // entire site — which is exactly what happened on 2026-08-04. Even with the
    // client guarded, `onAuthStateChange` returns a promise-like from the stub
    // and this line destructured `.data.subscription` off it synchronously,
    // throwing "Cannot read properties of undefined". The marketing pages, the
    // privacy policy and the terms need no session at all; they must render
    // whether or not auth is configured.
    if (!isSupabaseConfigured) return undefined

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    if (!isSupabaseConfigured) {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
