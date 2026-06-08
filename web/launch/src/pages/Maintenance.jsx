import SEO from '../components/SEO'

export default function Maintenance() {
  return (
    <>
      <SEO title="Maintenance" noindex />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 'var(--space-xl)', textAlign: 'center', gap: 'var(--space-lg)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', color: 'var(--color-text-primary)' }}>SwingBy</div>
        <div style={{ fontSize: '48px' }}>🔧</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '32px', color: 'var(--color-text-primary)' }}>Down for maintenance</h1>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px', fontSize: '15px', lineHeight: 1.6 }}>
          We're making some improvements. We'll be back shortly. Thank you for your patience.
        </p>
        <a href="/status" style={{ color: 'var(--color-accent-text)', fontSize: '14px' }}>Check status →</a>
      </div>
    </>
  )
}
