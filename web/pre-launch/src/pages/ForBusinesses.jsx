import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ChartLineUp,
  ClipboardText,
  Star,
} from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import shared from './page.module.css'
import s from './ForBusinesses.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

const VALUE_PROPS = [
  { icon: ChartLineUp, titleKey: 'forBusinesses.valueProp1Title', descKey: 'forBusinesses.valueProp1Desc' },
  { icon: ClipboardText, titleKey: 'forBusinesses.valueProp2Title', descKey: 'forBusinesses.valueProp2Desc' },
  { icon: Star, titleKey: 'forBusinesses.valueProp3Title', descKey: 'forBusinesses.valueProp3Desc' },
]

// Success stories removed: all three businesses were invented, quoting
// outcomes ("doubled our monthly bookings in the first 60 days") that no
// customer ever reported. Nothing replaces them until a real one exists.

export default function ForBusinesses() {
  const { t } = useTranslation()
  return (
    <>
      <SEO
        title="For Businesses"
        description="Grow your business with SwingByy. Get discovered by local clients, win more jobs, and build your reputation."
        og={{ url: 'https://swingbyy.com/for-businesses' }}
      />

      {/* Hero */}
      <section className={s.hero}>
        <div className={s.heroGlow} />
        <motion.div className={s.heroContent} {...fadeUp}>
          <h1 className={s.heroTitle}>{t('forBusinesses.heroTitle')}</h1>
          <p className={s.heroSubtitle}>{t('forBusinesses.heroSubtitle')}</p>
          <div className={s.heroCtas}>
            <Link to="/signup">
              <Button size="lg">{t('forBusinesses.ctaSignup')}</Button>
            </Link>
            <Link to="/pricing">
              <Button variant="secondary" size="lg">
                {t('forBusinesses.ctaLearnMore')} <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Value Props */}
      <section className={s.section}>
        <motion.h2 className={s.sectionTitle} {...fadeUp}>
          {t('forBusinesses.valuePropsTitle')}
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

      {/* Pricing Summary */}
      <section className={s.section}>
        <motion.div className={s.pricingBanner} {...fadeUp}>
          <div className={s.pricingContent}>
            <h2 className={s.pricingTitle}>{t('forBusinesses.pricingTitle')}</h2>
            <p className={s.pricingDesc}>{t('forBusinesses.pricingDesc')}</p>
            <Link to="/pricing">
              <Button variant="secondary" size="md">
                {t('forBusinesses.pricingCta')} <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
          <div className={s.pricingBadge}>
            <span className={s.pricingPercent}>10%</span>
            <span className={s.pricingLabel}>{t('pricing.platformFee')}</span>
          </div>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className={s.finalCta}>
        <motion.div className={s.finalCtaContent} {...fadeUp}>
          <h2 className={s.finalCtaTitle}>{t('forBusinesses.finalCtaTitle')}</h2>
          <p className={s.finalCtaSubtitle}>{t('forBusinesses.finalCtaSubtitle')}</p>
          <Link to="/signup">
            <Button size="lg">{t('forBusinesses.ctaSignup')}</Button>
          </Link>
        </motion.div>
      </section>
    </>
  )
}
