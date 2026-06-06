import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CircleNotch, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import s from './Auth.module.css'

export default function AuthCallback() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    async function handleCallback() {
      try {
        const { error } = await supabase.auth.getSession()
        if (error) throw error
        setStatus('success')
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
      } catch (err) {
        setError(err.message || t('errors.generic'))
        setStatus('error')
      }
    }
    handleCallback()
  }, [navigate, t])

  return (
    <>
      <SEO title="Authenticating — SwingBy" />
      <div className={s.page}>
        <div className={s.orb1} />
        <div className={s.orb2} />
        <div className={s.container}>
          <motion.div className={s.card} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {status === 'loading' && (
              <div className={s.success}>
                <div className={s.successIcon}><CircleNotch size={24} weight="bold" style={{ animation: 'spin 1s linear infinite' }} /></div>
                <h3>Authenticating...</h3>
                <p>{t('common.loading')}</p>
              </div>
            )}
            {status === 'success' && (
              <div className={s.success}>
                <div className={s.successIcon}><CheckCircle size={24} weight="bold" /></div>
                <h3>Welcome back!</h3>
                <p>Redirecting to your dashboard...</p>
              </div>
            )}
            {status === 'error' && (
              <div className={s.success}>
                <div style={{ width: 56, height: 56, background: 'rgba(255,92,92,0.12)', border: '1px solid rgba(255,92,92,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--color-danger)' }}>
                  <WarningCircle size={24} weight="bold" />
                </div>
                <h3>{t('errors.generic')}</h3>
                <p>{error}</p>
                <Button variant="primary" onClick={() => navigate('/login')} style={{ marginTop: 'var(--space-base)' }}>
                  {t('common.retry')}
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  )
}
