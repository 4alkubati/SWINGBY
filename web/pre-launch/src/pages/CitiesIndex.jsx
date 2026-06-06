import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MapPin, ArrowRight, Bell } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import shared from './page.module.css'
import s from './CitiesIndex.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

export default function CitiesIndex() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="Available Cities"
        description="SwingBy is live in Calgary with plans to expand across Canada. See where we operate."
        og={{ url: 'https://swingbyy.com/cities' }}
      />

      <section className={shared.heroSection}>
        <motion.div {...fadeUp}>
          <h1 className={shared.heroTitle}>{t('citiesIndex.heroTitle')}</h1>
          <p className={shared.heroSubtitle}>{t('citiesIndex.heroSubtitle')}</p>
        </motion.div>
      </section>

      <div className={s.container}>
        {/* Cities Grid */}
        <div className={s.grid}>
          <motion.div {...fadeUp}>
            <Link to="/cities/calgary" className={s.cityCard}>
              <div className={s.cityIcon}>
                <MapPin size={28} weight="bold" />
              </div>
              <div className={s.cityBody}>
                <h3 className={s.cityName}>Calgary, AB</h3>
                <p className={s.cityDesc}>{t('citiesIndex.calgaryDesc')}</p>
                <span className={s.cityStatus}>{t('citiesIndex.heroSubtitle').includes('live') ? 'Live' : 'Live'}</span>
              </div>
              <ArrowRight size={18} className={s.cityArrow} />
            </Link>
          </motion.div>
        </div>

        {/* Coming Soon */}
        <motion.div className={s.comingSoon} {...fadeUp}>
          <Bell size={32} weight="regular" className={s.comingSoonIcon} />
          <h3 className={s.comingSoonTitle}>{t('citiesIndex.moreCitiesTitle')}</h3>
          <p className={s.comingSoonDesc}>{t('citiesIndex.moreCitiesDesc')}</p>
          <Link to="/contact">
            <Button variant="secondary" size="md">
              {t('contact.title')}
            </Button>
          </Link>
        </motion.div>
      </div>
    </>
  )
}
