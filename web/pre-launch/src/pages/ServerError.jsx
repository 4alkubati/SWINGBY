import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { WarningCircle, ArrowCounterClockwise } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

export default function ServerError() {
  const { t } = useTranslation()

  return (
    <>
      <SEO title={`${t('errors.serverError')} — SwingBy`} />
      <motion.div {...fadeUp} style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl) var(--space-lg)', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,92,92,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-lg)', color: 'var(--color-danger)' }}>
          <WarningCircle size={36} weight="regular" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 8vw, 72px)', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, marginBottom: 'var(--space-sm)' }}>500</h1>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>{t('errors.serverError')}</h2>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', maxWidth: 420, lineHeight: 1.6, marginBottom: 'var(--space-xl)' }}>{t('errors.serverErrorDesc')}</p>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <Button variant="primary" onClick={() => window.location.reload()}>
            <ArrowCounterClockwise size={16} /> {t('common.retry')}
          </Button>
          <Link to="/"><Button variant="secondary">{t('nav.home')}</Button></Link>
        </div>
      </motion.div>
    </>
  )
}
