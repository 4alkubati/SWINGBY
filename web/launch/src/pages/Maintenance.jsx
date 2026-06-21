import SEO from '../components/SEO'

function WrenchIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="80" height="80" rx="20" fill="#2A2247" />
      <path d="M52 20a12 12 0 0 0-11.5 15.5L22 54a4 4 0 1 0 5.7 5.6l18.5-18.5A12 12 0 1 0 52 20zm0 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" fill="#6E56F7" />
    </svg>
  )
}

export default function Maintenance() {
  return (
    <>
      <SEO title="Maintenance" noindex />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 'var(--space-xl)', textAlign: 'center', gap: 'var(--space-lg)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', color: 'var(--color-accent-text)', letterSpacing: '-0.5px' }}>SwingBy</div>
        <WrenchIllustration />
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '32px', color: 'var(--color-text-primary)' }}>Back shortly</h1>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '420px', fontSize: '15px', lineHeight: 1.7 }}>
          We're making some improvements to SwingBy. This usually takes less than an hour.
          {/* ETA placeholder — TODO (HUMAN): replace with actual ETA when known */}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <a href="/status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
            Check status page
          </a>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Real-time updates at status.swingbyy.com</span>
        </div>
      </div>
    </>
  )
}
