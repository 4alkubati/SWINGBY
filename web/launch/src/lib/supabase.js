import { createClient } from '@supabase/supabase-js'

// WHY THIS IS GUARDED (ported from web/pre-launch, SB-0048)
// ---------------------------------------------------------
// This module used to be:
//
//   export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, ...)
//
// `createClient` THROWS "supabaseUrl is required" when the value is undefined, and
// it threw at MODULE SCOPE. AuthContext imports this file and App imports
// AuthContext — so one missing build-time env var took down the entire site with a
// blank black page. Not a broken route: nothing rendered at all, on every URL.
//
// That is exactly what happened to swingbyy.com on 2026-08-04. The fix landed in
// web/pre-launch and was never ported here, so this app kept the version that
// caused the outage — waiting for the first deploy without those two variables.
// CI could not catch it either: "Lint & Build" compiles this file perfectly,
// because the throw only happens when the bundle RUNS and nothing in CI renders
// a page.
//
// The rule this encodes: **a marketing page must not be able to die because an
// auth client could not initialise.** The landing pages, the privacy policy and
// the terms need no Supabase at all. Only the auth screens do, and those should
// fail where they are used, loudly, rather than taking the homepage with them.

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
