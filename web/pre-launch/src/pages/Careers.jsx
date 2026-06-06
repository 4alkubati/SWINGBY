import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Briefcase,
  HouseLine,
  Coin,
  Airplane,
  GraduationCap,
  Lightning,
  Handshake,
  Heart,
} from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import shared from './page.module.css'
import s from './Careers.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

const PERKS = [
  { icon: HouseLine, titleKey: 'careers.perk1Title', descKey: 'careers.perk1Desc' },
  { icon: Coin, titleKey: 'careers.perk2Title', descKey: 'careers.perk2Desc' },
  { icon: Airplane, titleKey: 'careers.perk3Title', descKey: 'careers.perk3Desc' },
  { icon: GraduationCap, titleKey: 'careers.perk4Title', descKey: 'careers.perk4Desc' },
]

const VALUES = [
  { icon: Lightning, titleKey: 'careers.value1Title', descKey: 'careers.value1Desc' },
  { icon: Handshake, titleKey: 'careers.value2Title', descKey: 'careers.value2Desc' },
  { icon: Heart, titleKey: 'careers.value3Title', descKey: 'careers.value3Desc' },
]

export default function Careers() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="Careers at SwingBy"
        description="Join the team building the future of local services. See our culture, perks, and open positions."
        og={{ url: 'https://swingbyy.com/careers' }}
      />

      {/* Hero */}
      <section className={shared.heroSection}>
        <motion.div {...fadeUp}>
          <h1 className={shared.heroTitle}>{t('careers.heroTitle')}</h1>
          <p className={shared.heroSubtitle}>{t('careers.heroSubtitle')}</p>
        </motion.div>
      </section>

      <div className={s.container}>
        {/* Empty State */}
        <motion.section className={s.emptyBlock} {...fadeUp}>
          <Briefcase size={48} weight="regular" className={s.emptyIcon} />
          <h2 className={s.emptyTitle}>{t('careers.emptyTitle')}</h2>
          <p className={s.emptyDesc}>{t('careers.emptyDesc')}</p>
          <Button variant="secondary" size="md" disabled>
            {t('careers.notifyMe')}
          </Button>
        </motion.section>

        <hr className={shared.divider} />

        {/* Perks */}
        <motion.section {...fadeUp}>
          <h2 className={s.sectionTitle}>{t('careers.perksTitle')}</h2>
          <div className={s.perksGrid}>
            {PERKS.map((perk, i) => {
              const Icon = perk.icon
              return (
                <motion.div
                  key={perk.titleKey}
                  className={s.perkCard}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.08 }}
                >
                  <div className={s.perkIcon}>
                    <Icon size={24} weight="regular" />
                  </div>
                  <h3 className={s.perkTitle}>{t(perk.titleKey)}</h3>
                  <p className={s.perkDesc}>{t(perk.descKey)}</p>
                </motion.div>
              )
            })}
          </div>
        </motion.section>

        <hr className={shared.divider} />

        {/* Values */}
        <motion.section {...fadeUp}>
          <h2 className={s.sectionTitle}>{t('careers.valuesTitle')}</h2>
          <div className={s.valuesGrid}>
            {VALUES.map((val, i) => {
              const Icon = val.icon
              return (
                <motion.div
                  key={val.titleKey}
                  className={s.valueCard}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: i * 0.1 }}
                >
                  <div className={s.valueIcon}>
                    <Icon size={24} weight="bold" />
                  </div>
                  <h3 className={s.valueTitle}>{t(val.titleKey)}</h3>
                  <p className={s.valueDesc}>{t(val.descKey)}</p>
                </motion.div>
              )
            })}
          </div>
        </motion.section>
      </div>
    </>
  )
}
