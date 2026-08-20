/**
 * supabase-guard.test.js — SB-0048.
 *
 * swingbyy.com went completely black on 2026-08-04 because this module called
 * createClient at import scope with undefined env vars. createClient throws,
 * AuthContext imports this file, App imports AuthContext — so a missing
 * build-time variable took down every URL on the site, not one route.
 *
 * The guard landed in web/pre-launch and was never ported here, leaving this
 * app holding the exact version that caused the outage. CI could not catch it:
 * the file compiles perfectly, and nothing in CI ever renders a page.
 *
 * This test renders nothing either — it asserts the property that matters:
 * importing the module with no configuration must not throw.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('supabase client guard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('imports cleanly when the env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const mod = await import('../lib/supabase.js')
    expect(mod.isSupabaseConfigured).toBe(false)
    expect(mod.supabase).toBeTruthy()
  })

  it('reports the failure where auth is USED, not at import', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    const { supabase } = await import('../lib/supabase.js')
    await expect(supabase.auth.signInWithPassword({})).rejects.toThrow(
      /not configured/i,
    )
  })

  it('builds a real client when configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    const mod = await import('../lib/supabase.js')
    expect(mod.isSupabaseConfigured).toBe(true)
    expect(typeof mod.supabase.auth.signInWithPassword).toBe('function')
  })
})
