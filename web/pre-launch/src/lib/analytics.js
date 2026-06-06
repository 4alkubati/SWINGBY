export function track(event, props = {}) {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(event, { props })
  }

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, props)
  }
}
