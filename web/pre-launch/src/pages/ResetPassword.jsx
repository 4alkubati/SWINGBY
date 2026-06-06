import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CheckCircle } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import { supabase } from '../lib/supabase'
import s from './Auth.module.css'

export default function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) { setError(t('auth.passwordRequirements')); setStatus('error'); return }
    if (password !== confirm) { setError('Passwords do not match'); setStatus('error'); return }

    setStatus('loading')
    setError('')

    const { error: err } = await supabase.auth.updateUser({ password })

    if (err) {
      setError(err.message)
      setStatus('error')
    } else {
      setStatus('success')
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000)
    }
  }

  return (
    <>
      <SEO title={`${t('auth.newPassword')} — SwingBy`} />
      <div className={s.page}>
        <div className={s.orb1} />
        <div className={s.orb2} />
        <nav className={s.nav}>
          <Link to="/" className={s.logo}>SwingBy</Link>
        </nav>
        <div className={s.container}>
          <motion.div className={s.card} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {status === 'success' ? (
              <div className={s.success}>
                <div className={s.successIcon}><CheckCircle size={24} weight="bold" /></div>
                <h3>Password updated</h3>
                <p>Redirecting to your dashboard...</p>
              </div>
            ) : (
              <>
                <div className={s.cardHeader}>
                  <h1>Set new password</h1>
                  <p>{t('auth.passwordRequirements')}</p>
                </div>
                <form onSubmit={handleSubmit} className={s.form} noValidate>
                  <div className={s.field}>
                    <label htmlFor="rp-password">{t('auth.newPassword')}</label>
                    <input id="rp-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" required />
                  </div>
                  <div className={s.field}>
                    <label htmlFor="rp-confirm">{t('auth.confirmPassword')}</label>
                    <input id="rp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" required />
                  </div>
                  {status === 'error' && error && <div className={s.errorMsg} role="alert">{error}</div>}
                  <button type="submit" className={s.submitBtn} disabled={status === 'loading'}>
                    {status === 'loading' ? t('common.loading') : 'Update password'}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </>
  )
}
