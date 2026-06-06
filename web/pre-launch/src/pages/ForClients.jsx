import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ShieldCheck,
  CurrencyDollar,
  LockSimple,
  Drop,
  Broom,
  Wrench,
  DeviceMobileCamera,
} from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import shared from './page.module.css'
import s from './ForClients.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

const VALUE_PROPS = [
  { icon: ShieldCheck, titleKey: 'forClients.valueProp1Title', descKey: 'forClients.valueProp1Desc' },
  { icon: CurrencyDollar, titleKey: 'forClients.valueProp2Title', descKey: 'forClients.valueProp2Desc' },
  { icon: LockSimple, titleKey: 'forClients.valueProp3Title', descKey: 'forClients.valueProp3Desc' },
]

const USE_CASES = [
  { icon: Drop, titleKey: 'forClients.useCase1Title', descKey: 'forClients.useCase1Desc' },
  { icon: Broom, titleKey: 'forClients.useCase2Title', descKey: 'forClients.useCase2Desc' },
  { icon: Wrench, titleKey: 'forClients.useCase3Title', descKey: 'forClients.useCase3Desc' },
]

export default function ForClients() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="For Clients"
        description="Find trusted local professionals, compare quotes, and book with confidence. SwingBy makes home services simple."
        og={{ url: 'https://swingbyy.com/for-clients' }}
      />

      {/* Hero */}
      <section className={s.hero}>
        <div className={s.heroGlow} />
        <motion.div className={s.heroContent} {...fadeUp}>
          <h1 className={s.heroTitle}>{t('forClients.heroTitle')}</h1>
          <p className={s.heroSubtitle}>{t('forClients.heroSubtitle')}</p>
          <div className={s.heroCtas}>
            <Link to="/download">
              <Button size="lg">{t('forClients.ctaDownload')}</Button>
            </Link>
            <Link to="/how-it-works">
              <Button variant="secondary" size="lg">
                {t('forClients.ctaHowItWorks')} <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Value Props */}
      <section className={s.section}>
        <motion.h2 className={s.sectionTitle} {...fadeUp}>
          {t('forClients.valuePropsTitle')}
        </motion.h2>
        <div className={shared.grid3}>
          {VALUE_PROPS.map((prop, i) => {
            const Icon = prop.icon
            return (
              <motion.div
                key={prop.titleKey}
                className={s.valueCard}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              >
                <div className={s.valueIcon}>
                  <Icon size={28} weight="regular" />
                </div>
                <h3 className={s.valueTitle}>{t(prop.titleKey)}</h3>
                <p className={s.valueDesc}>{t(prop.descKey)}</p>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Use Cases */}
      <section className={s.section}>
        <motion.h2 className={s.sectionTitle} {...fadeUp}>
          {t('forClients.useCasesTitle')}
        </motion.h2>
        <div className={s.useCases}>
          {USE_CASES.map((uc, i) => {
            const Icon = uc.icon
            return (
              <motion.div
                key={uc.titleKey}
                className={s.useCaseCard}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              >
                <div className={s.useCaseIcon}>
                  <Icon size={24} weight="bold" />
                </div>
                <div>
                  <h3 className={s.useCaseTitle}>{t(uc.titleKey)}</h3>
                  <p className={s.useCaseDesc}>{t(uc.descKey)}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Screenshots Placeholder */}
      <section className={s.section}>
        <motion.h2 className={s.sectionTitle} {...fadeUp}>
          {t('forClients.screenshotsTitle')}
        </motion.h2>
        <motion.div className={s.screenshotPlaceholder} {...fadeUp}>
          <DeviceMobileCamera size={48} weight="regular" />
          <p>{t('forClients.screenshotsPlaceholder')}</p>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className={s.finalCta}>
        <motion.div className={s.finalCtaContent} {...fadeUp}>
          <h2 className={s.finalCtaTitle}>{t('forClients.finalCtaTitle')}</h2>
          <p className={s.finalCtaSubtitle}>{t('forClients.finalCtaSubtitle')}</p>
          <Link to="/download">
            <Button size="lg">{t('forClients.ctaDownload')}</Button>
          </Link>
        </motion.div>
      </section>
    </>
  )
}
