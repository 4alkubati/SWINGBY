import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MagnifyingGlass, ChatText, CalendarCheck, Star, Storefront, Tag, TrendUp, UserPlus } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Tabs from '../components/Tabs'
import styles from './page.module.css'
import s from './HowItWorks.module.css'

const CLIENT_STEPS = [
  { icon: MagnifyingGlass, titleKey: 'howItWorks.clientStep1', descKey: 'howItWorks.clientStep1Desc' },
  { icon: ChatText, titleKey: 'howItWorks.clientStep2', descKey: 'howItWorks.clientStep2Desc' },
  { icon: CalendarCheck, titleKey: 'howItWorks.clientStep3', descKey: 'howItWorks.clientStep3Desc' },
  { icon: Star, titleKey: 'howItWorks.clientStep4', descKey: 'howItWorks.clientStep4Desc' },
]

const BIZ_STEPS = [
  { icon: Storefront, titleKey: 'howItWorks.bizStep1', descKey: 'howItWorks.bizStep1Desc' },
  { icon: MagnifyingGlass, titleKey: 'howItWorks.bizStep2', descKey: 'howItWorks.bizStep2Desc' },
  { icon: Tag, titleKey: 'howItWorks.bizStep3', descKey: 'howItWorks.bizStep3Desc' },
  { icon: TrendUp, titleKey: 'howItWorks.bizStep4', descKey: 'howItWorks.bizStep4Desc' },
]

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
}

export default function HowItWorks() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('clients')
  const steps = tab === 'clients' ? CLIENT_STEPS : BIZ_STEPS

  return (
    <>
      <SEO title={t('howItWorks.title')} description="Learn how SwingBy connects clients with local service providers in just a few simple steps." />
      <div className={styles.heroSection}>
        <h1 className={styles.heroTitle}>{t('howItWorks.title')}</h1>
        <p className={styles.heroSubtitle}>Two sides, one simple process. See how it works for you.</p>
      </div>
      <div className={styles.pageNarrow}>
        <div className={s.tabWrap}>
          <Tabs
            tabs={[
              { key: 'clients', label: t('howItWorks.forClients') },
              { key: 'businesses', label: t('howItWorks.forBusinesses') },
            ]}
            activeTab={tab}
            onChange={setTab}
          />
        </div>
        <div className={s.steps}>
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div key={step.titleKey} className={s.step} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                <div className={s.stepIcon}><Icon size={28} weight="regular" /></div>
                <div className={s.stepNum}>{String(i + 1).padStart(2, '0')}</div>
                <h3 className={s.stepTitle}>{t(step.titleKey)}</h3>
                <p className={s.stepDesc}>{t(step.descKey)}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </>
  )
}
