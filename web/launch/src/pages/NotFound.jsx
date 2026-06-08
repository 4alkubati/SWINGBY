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
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/" style={{ padding: '10px 20px', background: 'var(--color-accent-btn)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '14px' }}>Go home</Link>
          <Link to="/help" style={{ padding: '10px 20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '14px' }}>Help center</Link>
        </div>
      </div>
    </>
  )
}
