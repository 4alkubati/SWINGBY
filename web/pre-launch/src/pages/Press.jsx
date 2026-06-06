import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Newspaper, DownloadSimple, EnvelopeSimple, FileText } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import shared from './page.module.css'
import s from './Press.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

export default function Press() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="Newsroom"
        description="The latest news, press releases, and media resources from SwingBy."
        og={{ url: 'https://swingbyy.com/press' }}
      />

      {/* Hero */}
      <section className={shared.heroSection}>
        <motion.div {...fadeUp}>
          <h1 className={shared.heroTitle}>{t('press.heroTitle')}</h1>
          <p className={shared.heroSubtitle}>{t('press.heroSubtitle')}</p>
        </motion.div>
      </section>

      <div className={s.container}>
        {/* Press Releases */}
        <motion.section className={s.section} {...fadeUp}>
          <h2 className={s.sectionTitle}>
            <Newspaper size={24} weight="bold" /> {t('press.releasesTitle')}
          </h2>
          <div className={shared.emptyState}>
            <FileText size={48} weight="regular" className={shared.emptyIcon} />
            <h3 className={shared.emptyTitle}>{t('press.emptyTitle')}</h3>
            <p className={shared.emptyDesc}>{t('press.emptyDesc')}</p>
          </div>
        </motion.section>

        <hr className={shared.divider} />

        {/* Press Kit */}
        <motion.section className={s.section} {...fadeUp}>
          <div className={s.kitBlock}>
            <div className={s.kitIcon}>
              <DownloadSimple size={28} weight="regular" />
            </div>
            <div className={s.kitBody}>
              <h2 className={s.kitTitle}>{t('press.pressKitTitle')}</h2>
              <p className={s.kitDesc}>{t('press.pressKitDesc')}</p>
              <Button variant="secondary" size="md" disabled>
                <DownloadSimple size={16} weight="bold" /> {t('press.pressKitCta')}
              </Button>
            </div>
          </div>
        </motion.section>

        <hr className={shared.divider} />

        {/* Media Contact */}
        <motion.section className={s.contactBlock} {...fadeUp}>
          <EnvelopeSimple size={32} weight="regular" className={s.contactIcon} />
          <h2 className={s.contactTitle}>{t('press.mediaContactTitle')}</h2>
          <p className={s.contactDesc}>{t('press.mediaContactDesc')}</p>
          <a href={`mailto:${t('press.mediaEmail')}`} className={s.contactEmail}>
            {t('press.mediaEmail')}
          </a>
        </motion.section>
      </div>
    </>
  )
}
