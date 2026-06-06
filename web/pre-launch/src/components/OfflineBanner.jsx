import { useTranslation } from 'react-i18next'
import { WifiSlash } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'framer-motion'
import useOffline from '../hooks/useOffline'

export default function OfflineBanner() {
  const { t } = useTranslation()
  const offline = useOffline()

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{
            background: 'var(--color-warning)',
            color: 'var(--color-bg)',
            padding: 'var(--space-sm) var(--space-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-sm)',
            fontSize: '13px',
            fontWeight: 600,
            overflow: 'hidden',
          }}
          role="alert"
        >
          <WifiSlash size={16} weight="bold" />
          {t('errors.offline')} — {t('errors.offlineDesc')}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
