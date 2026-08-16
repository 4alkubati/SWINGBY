// analytics.js — PostHog, loaded only when a key is configured.
//
// Replaces Plausible (removed 2026-08-15). Plausible answers "how many people
// came"; the only questions that matter before the October launch are funnel
// questions — how many reached the waitlist, from which entry point, and where
// the rest fell out. PostHog answers those on a free tier far larger than a
// pre-launch site will ever need.
//
// Loaded from the CDN via PostHog's own snippet rather than the posthog-js npm
// package, deliberately: no new dependency, no package-lock churn, and nothing
// in the bundle at all for a build with no key set.
//
// The hosts must also be allowed in public/_headers — the site sends a real CSP
// and a blocked script fails silently, which is the worst way for analytics to
// break. US hosts are the default; for an EU project swap `us.i`/`us-assets`
// for `eu.i`/`eu-assets` in BOTH this file's default and the CSP.
//
// PostHog is named as a processor in privacy-and-security/subprocessors.md and
// the cookie policy. If that stops being true, this file has to go.

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

export function initAnalytics() {
  if (!KEY) return
  if (typeof window === 'undefined' || window.posthog?.__loaded) return

  // PostHog's official snippet: it stubs the API so calls made before the
  // script lands are queued rather than thrown.
  !(function (t, e) {
    var o, n, p, r
    e.__SV ||
      ((window.posthog = e),
      (e._i = []),
      (e.init = function (i, s, a) {
        function g(t, e) {
          var o = e.split('.')
          2 == o.length && ((t = t[o[0]]), (e = o[1]))
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)))
          }
        }
        ;(p = t.createElement('script')).type = 'text/javascript'
        p.crossOrigin = 'anonymous'
        p.async = !0
        p.src =
          (s.api_host || HOST).replace('.i.posthog.com', '-assets.i.posthog.com') +
          '/static/array.js'
        ;(r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r)
        var u = e
        for (
          void 0 !== a ? (u = e[a] = []) : (a = 'posthog'),
            u.people = u.people || [],
            u.toString = function (t) {
              var e = 'posthog'
              return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e
            },
            u.people.toString = function () {
              return u.toString(1) + '.people (stub)'
            },
            o = 'init capture register register_once unregister getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags identify setPersonProperties group reset get_distinct_id get_session_id alias set_config opt_in_capturing opt_out_capturing has_opted_out_capturing debug'.split(
              ' '
            ),
            n = 0;
          n < o.length;
          n++
        )
          g(u, o[n])
        e._i.push([i, s, a])
      }),
      (e.__SV = 1))
  })(document, window.posthog || [])

  window.posthog.init(KEY, {
    api_host: HOST,
    // Pageviews are captured by hand on route change instead — this is a SPA
    // and the default listener only ever sees the first URL.
    capture_pageview: false,
    // localStorage, NOT the default localStorage+cookie: the privacy and
    // cookies pages both promise cookie-free analytics, and that promise is
    // cheaper to keep than to renegotiate with a consent banner.
    persistence: 'localStorage',
  })
  window.posthog.capture('$pageview')
}

/** Call on every SPA route change; the automatic listener cannot see them. */
export function trackPageview(path) {
  window.posthog?.capture?.('$pageview', path ? { $current_url: path } : undefined)
}

/** One named event. No-op when analytics is not configured.
 *  Same signature as the Plausible helper this replaces. */
export function track(event, props = {}) {
  window.posthog?.capture?.(event, props)
}
