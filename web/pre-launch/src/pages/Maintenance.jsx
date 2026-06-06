import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Wrench, TwitterLogo } from '@phosphor-icons/react'
import SEO from '../components/SEO'

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

export default function Maintenance() {
  const { t } = useTranslation()

  return (
    <>
      <SEO title="Maintenance — SwingBy" />
      <motion.div {...fadeUp} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-2xl) var(--space-lg)', textAlign: 'center', background: 'var(--color-bg)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-lg)', color: 'var(--color-accent-text)' }}>
          <Wrench size={36} weight="regular" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>
          We'll be right back
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', maxWidth: 460, lineHeight: 1.6, marginBottom: 'var(--space-xl)' }}>
          SwingBy is currently undergoing scheduled maintenance. We're working hard to improve your experience and will be back shortly.
        </p>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', maxWidth: 360, width: '100%' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Estimated return:</strong> Within the next hour
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)' }}>
            Follow us on social media for real-time updates.
          </p>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xl)' }}>
          Questions? Email <a href="mailto:support@swingbyy.com" style={{ color: 'var(--color-accent-text)' }}>support@swingbyy.com</a>
        </p>
      </motion.div>
    </>
  )
}
