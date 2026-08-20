/**
 * csp.test.js — SB-0039: the production waitlist form was blocked by our own CSP.
 *
 * `.env.production` points the app at https://api.swingbyy.com (the Cloudflare
 * Worker), and `public/_headers` listed only https://swingbyy-api.onrender.com
 * in `connect-src`. So every waitlist signup on the live site was refused by
 * the browser before a request left it — the one conversion the pre-launch site
 * exists for, on the only property in production.
 *
 * Nothing could have caught that: the CSP is a static file, the API base is an
 * env var, and no test read either. This reads BOTH and checks they agree, so
 * changing one without the other fails here instead of in a user's browser.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function cspDirectives() {
  const headers = readFileSync(resolve(APP, 'public/_headers'), 'utf8')
  const line = headers
    .split('\n')
    .find((l) => l.includes('Content-Security-Policy:'))
  expect(line, 'public/_headers has no Content-Security-Policy').toBeTruthy()
  const policy = line.slice(line.indexOf('Content-Security-Policy:') + 24).trim()
  return Object.fromEntries(
    policy
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/)
        return [name, values]
      }),
  )
}

function productionApiOrigin() {
  const env = readFileSync(resolve(APP, '.env.production'), 'utf8')
  const line = env
    .split('\n')
    .find((l) => l.trim().startsWith('VITE_API_URL='))
  expect(line, '.env.production has no VITE_API_URL').toBeTruthy()
  return new URL(line.split('=')[1].trim()).origin
}

describe('production CSP', () => {
  it('allows the API origin the app is actually configured to call', () => {
    const origin = productionApiOrigin()
    const connect = cspDirectives()['connect-src'] ?? []
    const allowed = connect.some((source) => {
      if (source === origin) return true
      if (!source.startsWith('https://*.')) return false
      return origin.endsWith(source.replace('https://*.', '.'))
    })
    expect(
      allowed,
      `connect-src does not allow ${origin}, so every call the app makes to ` +
        `its own API is blocked by the browser. connect-src = ${connect.join(' ')}`,
    ).toBe(true)
  })

  it('still refuses to be framed and still defaults to self', () => {
    const directives = cspDirectives()
    expect(directives['frame-ancestors']).toEqual(["'none'"])
    expect(directives['default-src']).toEqual(["'self'"])
  })
})
