import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { EnvelopeSimple, ArrowRight } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import { supabase } from '../lib/supabase'
import s from './Auth.module.css'

export default function VerifyEmail() {
  const { t } = useTranslation()
  const [resendStatus, setResendStatus] = useState('idle')

  async function handleResend() {
    setResendStatus('loading')
    const { error } = await supabase.auth.resend({ type: 'signup', email: '' })
    setResendStatus(error ? 'error' : 'sent')
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
              <p>{t('auth.verifyEmailDesc')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)', alignItems: 'center' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResend}
                  disabled={resendStatus === 'loading' || resendStatus === 'sent'}
                >
                  {resendStatus === 'sent' ? 'Email sent!' : resendStatus === 'loading' ? t('common.loading') : t('auth.resendEmail')}
                </Button>
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)' }}>
                  Back to login <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}
