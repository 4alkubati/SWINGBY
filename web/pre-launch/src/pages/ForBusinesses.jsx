import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChartLineUp,
  ClipboardText,
  Star,
  Quotes,
  CaretLeft,
  CaretRight,
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

const STORIES = [
  { nameKey: 'forBusinesses.story1Name', quoteKey: 'forBusinesses.story1Quote', roleKey: 'forBusinesses.story1Role' },
  { nameKey: 'forBusinesses.story2Name', quoteKey: 'forBusinesses.story2Quote', roleKey: 'forBusinesses.story2Role' },
  { nameKey: 'forBusinesses.story3Name', quoteKey: 'forBusinesses.story3Quote', roleKey: 'forBusinesses.story3Role' },
]

export default function ForBusinesses() {
  const { t } = useTranslation()
  const [activeStory, setActiveStory] = useState(0)

  const nextStory = useCallback(() => {
    setActiveStory((prev) => (prev + 1) % STORIES.length)
  }, [])

  const prevStory = useCallback(() => {
    setActiveStory((prev) => (prev - 1 + STORIES.length) % STORIES.length)
  }, [])

  useEffect(() => {
    const timer = setInterval(nextStory, 5000)
    return () => clearInterval(timer)
  }, [nextStory])

  return (
    <>
      <SEO
        title="For Businesses"
        description="Grow your business with SwingBy. Get discovered by local clients, win more jobs, and build your reputation."
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

      {/* Success Stories Carousel */}
      <section className={s.section}>
        <motion.h2 className={s.sectionTitle} {...fadeUp}>
          {t('forBusinesses.storiesTitle')}
        </motion.h2>
        <motion.div className={s.carousel} {...fadeUp}>
          <button
            className={s.carouselBtn}
            onClick={prevStory}
            aria-label="Previous story"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <div className={s.carouselTrack}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStory}
                className={s.storyCard}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
              >
                <Quotes size={32} weight="bold" className={s.storyQuoteIcon} />
                <p className={s.storyQuote}>{t(STORIES[activeStory].quoteKey)}</p>
                <div className={s.storyAuthor}>
                  <span className={s.storyName}>{t(STORIES[activeStory].nameKey)}</span>
                  <span className={s.storyRole}>{t(STORIES[activeStory].roleKey)}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <button
            className={s.carouselBtn}
            onClick={nextStory}
            aria-label="Next story"
          >
            <CaretRight size={20} weight="bold" />
          </button>
        </motion.div>
        <div className={s.carouselDots}>
          {STORIES.map((_, i) => (
            <button
              key={i}
              className={`${s.dot} ${i === activeStory ? s.dotActive : ''}`}
              onClick={() => setActiveStory(i)}
              aria-label={`Go to story ${i + 1}`}
            />
          ))}
        </div>
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
