import { Link } from 'react-router-dom'
import SEO from '../components/SEO'

export default function VerifyEmail() {
  return (
    <>
      <SEO title="Verify email" noindex />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 'var(--space-xl)' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--color-text-primary)', marginBottom: '12px' }}>Check your email</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: 'var(--space-xl)' }}>
            We've sent you a verification link. Click it to confirm your account and continue.
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Didn't get it? Check spam, or <Link to="/signup" style={{ color: 'var(--color-accent-text)' }}>try signing up again</Link>.
          </p>
        </div>
      </div>
    </>
  )
}
