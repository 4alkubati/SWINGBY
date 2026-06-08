import { supabase } from './supabase'
import api from './api'

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function loginWithPassword(email, password) {
  const res = await api.post('/auth/login', { email, password })
  return res.data
}

export async function loginWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  })
  if (error) throw error
}

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
  if (error) throw error
}

export async function signup(data) {
  const res = await api.post('/auth/signup', data)
  return res.data
}

export async function logout() {
  try {
    const session = await getSession()
    if (session) {
      await api.post('/auth/logout')
    }
  } catch {}
  await supabase.auth.signOut()
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
