import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CheckCircle } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import { supabase } from '../lib/supabase'
import s from './Auth.module.css'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setError('')

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (err) {
      setError(err.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <>
      <SEO title={`${t('auth.resetPasswordTitle')} — SwingBy`} />
      <div className={s.page}>
        <div className={s.orb1} />
        <div className={s.orb2} />
        <nav className={s.nav}>
          <Link to="/" className={s.logo}>SwingBy</Link>
          <Link to="/login" className={s.navLink}>{t('common.login')}</Link>
        </nav>
        <div className={s.container}>
          <motion.div className={s.card} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {status === 'sent' ? (
              <div className={s.success}>
                <div className={s.successIcon}><CheckCircle size={24} weight="bold" /></div>
                <h3>{t('auth.verifyEmailTitle')}</h3>
                <p>We sent a password reset link to <strong>{email}</strong>. Check your inbox.</p>
              </div>
            ) : (
              <>
                <div className={s.cardHeader}>
                  <h1>{t('auth.resetPasswordTitle')}</h1>
                  <p>{t('auth.resetPasswordDesc')}</p>
                </div>
                <form onSubmit={handleSubmit} className={s.form} noValidate>
                  <div className={s.field}>
                    <label htmlFor="fp-email">{t('auth.email')}</label>
                    <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" required />
                  </div>
                  {status === 'error' && error && <div className={s.errorMsg} role="alert">{error}</div>}
                  <button type="submit" className={s.submitBtn} disabled={status === 'loading'}>
                    {status === 'loading' ? t('common.loading') : 'Send reset link'}
                  </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
                  <Link to="/login" style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>← Back to login</Link>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </>
  )
}
