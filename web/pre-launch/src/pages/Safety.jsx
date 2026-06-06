import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  IdentificationCard,
  Certificate,
  Eye,
  Lifebuoy,
  Scales,
  EnvelopeSimple,
} from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import shared from './page.module.css'
import s from './Safety.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

const VERIFY_STEPS = [
  { icon: IdentificationCard, titleKey: 'safety.verifyStep1Title', descKey: 'safety.verifyStep1Desc' },
  { icon: Certificate, titleKey: 'safety.verifyStep2Title', descKey: 'safety.verifyStep2Desc' },
  { icon: Eye, titleKey: 'safety.verifyStep3Title', descKey: 'safety.verifyStep3Desc' },
]

export default function Safety() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="Trust & Safety"
        description="Learn how SwingBy verifies businesses, protects clients, and resolves disputes. Your safety is our priority."
        og={{ url: 'https://swingbyy.com/safety' }}
      />

      {/* Hero */}
      <section className={shared.heroSection}>
        <motion.div {...fadeUp}>
          <ShieldCheck size={48} weight="bold" className={s.heroIcon} />
          <h1 className={shared.heroTitle}>{t('safety.heroTitle')}</h1>
          <p className={shared.heroSubtitle}>{t('safety.heroSubtitle')}</p>
        </motion.div>
      </section>

      <div className={s.container}>
        {/* Verification Steps */}
        <motion.section className={s.section} {...fadeUp}>
          <h2 className={s.sectionTitle}>{t('safety.verificationTitle')}</h2>
          <div className={s.steps}>
            {VERIFY_STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.titleKey}
                  className={s.stepCard}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                >
                  <div className={s.stepNum}>{String(i + 1).padStart(2, '0')}</div>
                  <div className={s.stepIcon}>
                    <Icon size={28} weight="regular" />
                  </div>
                  <div className={s.stepBody}>
                    <h3 className={s.stepTitle}>{t(step.titleKey)}</h3>
                    <p className={s.stepDesc}>{t(step.descKey)}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.section>

        <hr className={shared.divider} />

        {/* Insurance */}
        <motion.section className={s.section} {...fadeUp}>
          <div className={s.infoBlock}>
            <div className={s.infoIcon}>
              <Lifebuoy size={28} weight="regular" />
            </div>
            <div>
              <h2 className={s.infoTitle}>{t('safety.insuranceTitle')}</h2>
              <p className={s.infoDesc}>{t('safety.insuranceDesc')}</p>
            </div>
          </div>
        </motion.section>

        {/* Dispute Resolution */}
        <motion.section className={s.section} {...fadeUp}>
          <div className={s.infoBlock}>
            <div className={s.infoIcon}>
              <Scales size={28} weight="regular" />
            </div>
            <div>
              <h2 className={s.infoTitle}>{t('safety.disputeTitle')}</h2>
              <p className={s.infoDesc}>{t('safety.disputeDesc')}</p>
            </div>
          </div>
        </motion.section>

        <hr className={shared.divider} />

        {/* Contact */}
        <motion.section className={s.contactSection} {...fadeUp}>
          <EnvelopeSimple size={32} weight="regular" className={s.contactIcon} />
          <h2 className={s.contactTitle}>{t('safety.contactTitle')}</h2>
          <p className={s.contactDesc}>{t('safety.contactDesc')}</p>
          <Link to="/contact">
            <Button variant="secondary">{t('safety.contactCta')}</Button>
          </Link>
        </motion.section>
      </div>
    </>
  )
}
