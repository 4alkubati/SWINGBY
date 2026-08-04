import { createClient } from '@supabase/supabase-js'

// WHY THIS IS GUARDED (2026-08-04)
// --------------------------------
// This module used to be:
//
//   export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, ...)
//
// `createClient` THROWS "supabaseUrl is required" when the value is undefined,
// and it threw at MODULE SCOPE. `AuthContext` imports this file and `App` imports
// AuthContext — so one missing build-time env var took down the entire site with a
// blank black page. Not a broken route: nothing rendered at all, on every URL.
//
// That is exactly what happened when swingbyy.com was rebuilt for the first time
// since before 2026-06-05. `web/pre-launch/.env.production` carries VITE_API_URL
// but has never carried VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY; the old frozen
// bundle had been built somewhere that did. CI never caught it, because
// "Lint & Build" compiles this file perfectly — the throw only happens when the
// bundle RUNS, and nothing in CI ever rendered a page.
//
// The rule this encodes: **a marketing page must not be able to die because an
// auth client could not initialise.** The waitlist, the privacy policy and the
// terms need no Supabase at all. Only the auth screens do, and those should fail
// where they are used, loudly, instead of taking the homepage down with them.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

const MISSING =
  'Supabase is not configured for this build: VITE_SUPABASE_URL and ' +
  'VITE_SUPABASE_ANON_KEY are missing from the build environment. Auth is ' +
  'unavailable; the rest of the site is unaffected.'

// Configured: this is the real client and nothing changes.
// Not configured: every property access yields something callable that rejects
// with the message above — so a login button reports a real, readable failure at
// the moment it is pressed, while merely importing this file stays free.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : new Proxy(
      {},
      {
        get() {
          return new Proxy(function () {}, {
            apply: () => Promise.reject(new Error(MISSING)),
            get: () => () => Promise.reject(new Error(MISSING)),
          })
        },
      },
    )

if (!isSupabaseConfigured && typeof console !== 'undefined') {
  // One line at load, so a deployed build missing the vars says so in the console
  // instead of being discovered from a black screen.
  console.warn('[supabase] ' + MISSING)
}
