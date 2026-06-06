import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MapPin } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import StatsBlock from '../components/StatsBlock'
import shared from './page.module.css'
import s from './CalgaryPage.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

export default function CalgaryPage() {
  const { t } = useTranslation()
  const neighborhoods = t('calgary.neighborhoods').split(',')

  return (
    <>
      <SEO
        title="SwingBy in Calgary"
        description="Calgary's go-to marketplace for local home services. Find verified businesses for cleaning, plumbing, electrical, and more."
        og={{ url: 'https://swingbyy.com/cities/calgary' }}
      />

      {/* Hero */}
      <section className={s.hero}>
        <div className={s.heroGlow} />
        <motion.div className={s.heroContent} {...fadeUp}>
          <div className={s.heroBadge}>
            <MapPin size={16} weight="bold" /> Calgary, AB
          </div>
          <h1 className={s.heroTitle}>{t('calgary.heroTitle')}</h1>
          <p className={s.heroSubtitle}>{t('calgary.heroSubtitle')}</p>
          <div className={s.heroCtas}>
            <Link to="/signup">
              <Button size="lg">{t('common.getStarted')}</Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className={s.section}>
        <motion.h2 className={s.sectionTitle} {...fadeUp}>
          {t('calgary.statsTitle')}
        </motion.h2>
        <motion.div {...fadeUp}>
          <StatsBlock stats={[
            { value: 500, suffix: '+', label: t('calgary.statBusinesses') },
            { value: 12000, suffix: '+', label: t('calgary.statJobs') },
            { value: 4.8, suffix: '/5', label: t('calgary.statRating') },
            { value: 30, suffix: 'min', label: t('calgary.statResponse') },
          ]} />
        </motion.div>
      </section>

      {/* Neighborhoods */}
      <section className={s.section}>
        <motion.h2 className={s.sectionTitle} {...fadeUp}>
          {t('calgary.neighborhoodsTitle')}
        </motion.h2>
        <motion.div className={s.neighborhoodGrid} {...fadeUp}>
          {neighborhoods.map((name, i) => (
            <motion.div
              key={name}
              className={s.neighborhoodChip}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              <MapPin size={14} weight="bold" />
              {name.trim()}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA */}
      <section className={s.finalCta}>
        <motion.div className={s.finalCtaContent} {...fadeUp}>
          <h2 className={s.finalCtaTitle}>{t('calgary.ctaTitle')}</h2>
          <p className={s.finalCtaSubtitle}>{t('calgary.ctaSubtitle')}</p>
          <div className={s.heroCtas}>
            <Link to="/signup">
              <Button size="lg">{t('common.getStarted')}</Button>
            </Link>
            <Link to="/for-businesses">
              <Button variant="secondary" size="lg">{t('nav.forBusinesses')}</Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </>
  )
}
