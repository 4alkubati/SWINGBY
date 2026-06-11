import { Link } from 'react-router-dom'
import SEO from '../components/SEO'

export default function NotFound() {
  return (
    <>
      <SEO title="Page not found" noindex />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 'var(--space-xl)', textAlign: 'center', gap: 'var(--space-lg)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '80px', color: 'var(--color-accent-muted)', lineHeight: 1 }}>404</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--color-text-primary)' }}>Page not found</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>That page doesn't exist or has moved.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxWidth: '400px', width: '100%' }}>
          {[
            { to: '/', label: 'Home', desc: 'Back to the start' },
            { to: '/help', label: 'Help center', desc: 'Get answers' },
            { to: '/pricing', label: 'Pricing', desc: 'See our plans' },
            { to: '/login', label: 'Sign in', desc: 'Access your account' },
          ].map(({ to, label, desc }) => (
            <Link key={to} to={to} style={{ display: 'block', padding: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', textDecoration: 'none' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
