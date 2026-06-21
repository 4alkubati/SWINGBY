import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { EnvelopeSimple, ArrowRight } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import s from './Auth.module.css'

export default function VerifyEmail() {
  const { t } = useTranslation()
  const location = useLocation()
  const [params] = useSearchParams()
  // Email may come from router state (post-signup) or ?email= (deep links).
  const presetEmail = location.state?.email || params.get('email') || ''
  const [email, setEmail] = useState(presetEmail)
  const [resendStatus, setResendStatus] = useState('idle')
  const [resendError, setResendError] = useState('')

  async function handleResend(e) {
    e?.preventDefault?.()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      setResendError('Enter the email you signed up with.')
      setResendStatus('error')
      return
    }
    setResendStatus('loading')
    setResendError('')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setResendError(error.message)
      setResendStatus('error')
    } else {
      setResendStatus('sent')
    }
  }

  return (
    <>
      <SEO title={`${t('auth.verifyEmailTitle')} — SwingBy`} />
      <div className={s.page}>
        <div className={s.orb1} />
        <div className={s.orb2} />
        <nav className={s.nav}>
          <Link to="/" className={s.logo}>SwingBy</Link>
        </nav>
        <div className={s.container}>
          <motion.div className={s.card} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className={s.success}>
              <div className={s.successIcon}>
                <EnvelopeSimple size={24} weight="bold" />
              </div>
              <h3>{t('auth.verifyEmailTitle')}</h3>
              <p>
                {presetEmail
                  ? <>We sent a confirmation link to <strong>{presetEmail}</strong>. Click it to activate your account.</>
                  : t('auth.verifyEmailDesc')}
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)' }}>
                Didn't get it? Check your spam folder, then resend below.
              </p>
              <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)', alignItems: 'stretch' }}>
                {!presetEmail && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (resendStatus === 'error') setResendStatus('idle') }}
                    placeholder="your@email.com"
                    autoComplete="email"
                    required
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: 14,
                    }}
                  />
                )}
                {resendStatus === 'error' && resendError && (
                  <div className={s.errorMsg} role="alert">{resendError}</div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  type="submit"
                  disabled={resendStatus === 'loading' || resendStatus === 'sent'}
                >
                  {resendStatus === 'sent'
                    ? 'Email sent ✓'
                    : resendStatus === 'loading'
                      ? t('common.loading')
                      : t('auth.resendEmail')}
                </Button>
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: '13px', color: 'var(--color-text-secondary)', justifyContent: 'center', marginTop: 'var(--space-sm)' }}>
                  Back to login <ArrowRight size={14} />
                </Link>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}
