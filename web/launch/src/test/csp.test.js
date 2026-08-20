/**
 * csp.test.js — the shipped Content-Security-Policy is a static file that no
 * code path reads, so nothing catches it drifting away from what the app
 * actually calls.
 *
 * That is not hypothetical: on the pre-launch site the same file omitted
 * https://api.swingbyy.com from `connect-src` while the app was configured to
 * call exactly that origin, so every waitlist signup was refused by the browser
 * before a request left it (SB-0039). This app's policy is currently correct —
 * this test is what keeps it that way.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function cspDirectives() {
  const headers = readFileSync(resolve(APP, 'public/_headers'), 'utf8')
  const line = headers.split('\n').find((l) => l.includes('Content-Security-Policy:'))
  expect(line, 'public/_headers has no Content-Security-Policy').toBeTruthy()
  const policy = line.slice(line.indexOf('Content-Security-Policy:') + 24).trim()
  return Object.fromEntries(
    policy
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const [name, ...values] = p.split(/\s+/)
        return [name, values]
      }),
  )
}

describe('shipped CSP', () => {
  it('allows every backend origin this app can be pointed at', () => {
    const connect = cspDirectives()['connect-src'] ?? []
    for (const origin of [
      'https://swingbyy-api.onrender.com', // Render backend
      'https://api.swingbyy.com', // Cloudflare Worker
    ]) {
      expect(
        connect.includes(origin),
        `connect-src omits ${origin}; calls to it would be blocked by the browser`,
      ).toBe(true)
    }
  })

  it('keeps the framing and default-src guards', () => {
    const d = cspDirectives()
    expect(d['frame-ancestors']).toEqual(["'none'"])
    expect(d['default-src']).toEqual(["'self'"])
  })

  it('does not silently allow arbitrary hosts', () => {
    const connect = cspDirectives()['connect-src'] ?? []
    expect(connect).not.toContain('*')
    expect(connect).not.toContain('https:')
  })
})
