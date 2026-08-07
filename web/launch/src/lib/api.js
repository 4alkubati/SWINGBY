import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut()
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.href = `/login?next=${next}`
    }
    return Promise.reject(error)
  }
)

/**
 * Unwrap a paginated list endpoint.
 *
 * `GET /bookings/` returns `{items, limit, offset, next_offset}` — never a bare
 * array. Six pages independently wrote `.then(r => r.data)` and then treated the
 * result as a list. The envelope object is truthy, so a `= []` useQuery default
 * never fires, and the page either crashes on `.map` or silently renders "none".
 *
 * Anything reading a list endpoint should go through this rather than reaching
 * for `.data` and hoping.
 */
export const pageItems = (res) => {
  const body = res?.data
  if (Array.isArray(body)) return body        // tolerate a bare array
  return Array.isArray(body?.items) ? body.items : []
}

export default api
