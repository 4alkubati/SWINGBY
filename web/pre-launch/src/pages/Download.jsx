import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  AppleLogo,
  GooglePlayLogo,
  QrCode,
  ShieldCheck,
  Lightning,
  Star,
  MapPin,
  DeviceMobile,
} from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import styles from './Download.module.css'
import pageStyles from './page.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

const stagger = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-30px' },
}

const FEATURES = [
  {
    icon: Lightning,
    titleKey: 'download.feature1Title',
    descKey: 'download.feature1Desc',
    fallbackTitle: 'Instant Quotes',
    fallbackDesc: 'Post a job and receive competitive quotes from verified businesses within minutes.',
  },
  {
    icon: ShieldCheck,
    titleKey: 'download.feature2Title',
    descKey: 'download.feature2Desc',
    fallbackTitle: 'Verified Pros',
    fallbackDesc: 'Every business is identity-checked, licensed, and background-screened.',
  },
  {
    icon: Star,
    titleKey: 'download.feature3Title',
    descKey: 'download.feature3Desc',
    fallbackTitle: 'Transparent Reviews',
    fallbackDesc: 'Only clients who booked can review, so every rating is genuine.',
  },
  {
    icon: MapPin,
    titleKey: 'download.feature4Title',
    descKey: 'download.feature4Desc',
    fallbackTitle: 'Local First',
    fallbackDesc: 'Find professionals in your neighborhood who know your area best.',
  },
]

export default function Download() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title={t('common.downloadApp', 'Download the App')}
        description="Download SwingBy on iOS and Android. Find and book verified local service providers in Calgary."
      />

      <div className={styles.page}>
        {/* Hero */}
        <section className={styles.hero}>
          <motion.div className={styles.heroContent} {...fadeUp}>
            <span className={styles.badge}>
              <DeviceMobile size={14} weight="bold" />
              {t('common.comingSoon', 'Coming Soon')}
            </span>
            <h1 className={pageStyles.heroTitle}>
              {t('download.heroTitle', 'Get SwingBy on your phone')}
            </h1>
            <p className={pageStyles.heroSubtitle}>
              {t(
                'download.heroSubtitle',
                'Book trusted local pros in seconds. Available soon on iOS and Android.'
              )}
            </p>

            <div className={styles.storeButtons}>
              <a
                href="https://apps.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.storeBtn}
                aria-label="Download on the App Store"
              >
                <AppleLogo size={24} weight="fill" />
                <span className={styles.storeBtnText}>
                  <span className={styles.storeBtnSmall}>
                    {t('download.downloadOn', 'Download on the')}
                  </span>
                  App Store
                </span>
              </a>
              <a
                href="https://play.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.storeBtn}
                aria-label="Get it on Google Play"
              >
                <GooglePlayLogo size={24} weight="fill" />
                <span className={styles.storeBtnText}>
                  <span className={styles.storeBtnSmall}>
                    {t('download.getItOn', 'Get it on')}
                  </span>
                  Google Play
                </span>
              </a>
            </div>
          </motion.div>

          <motion.div
            className={styles.heroVisual}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0, 0, 0.2, 1] }}
          >
            <div className={styles.phoneMockup}>
              <div className={styles.phoneScreen}>
                <div className={styles.phoneStatusBar} />
                <div className={styles.phoneContent}>
                  <div className={styles.phoneLine} style={{ width: '60%' }} />
                  <div className={styles.phoneLine} style={{ width: '80%' }} />
                  <div className={styles.phoneCard} />
                  <div className={styles.phoneCard} />
                  <div className={styles.phoneLine} style={{ width: '50%' }} />
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* QR Code */}
        <motion.section className={styles.qrSection} {...fadeUp}>
          <div className={styles.qrCard}>
            <div className={styles.qrPlaceholder} aria-label="QR code placeholder">
              <QrCode size={80} weight="thin" />
            </div>
            <div className={styles.qrText}>
              <h3 className={styles.qrTitle}>
                {t('download.qrTitle', 'Scan to download')}
              </h3>
              <p className={styles.qrDesc}>
                {t(
                  'download.qrDesc',
                  'Point your phone camera at the QR code to get the app.'
                )}
              </p>
            </div>
          </div>
        </motion.section>

        {/* Features */}
        <section className={styles.features}>
          <motion.h2 className={pageStyles.sectionTitle} {...fadeUp}>
            {t('download.featuresTitle', 'Why download SwingBy?')}
          </motion.h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon
              return (
                <motion.div
                  key={feat.titleKey}
                  className={styles.featureCard}
                  {...stagger}
                  transition={{ duration: 0.4, delay: i * 0.1, ease: [0, 0, 0.2, 1] }}
                >
                  <div className={styles.featureIcon}>
                    <Icon size={24} weight="duotone" />
                  </div>
                  <h3 className={styles.featureTitle}>
                    {t(feat.titleKey, feat.fallbackTitle)}
                  </h3>
                  <p className={styles.featureDesc}>
                    {t(feat.descKey, feat.fallbackDesc)}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Screenshots */}
        <section className={styles.screenshots}>
          <motion.h2 className={pageStyles.sectionTitle} {...fadeUp}>
            {t('download.screenshotsTitle', 'See it in action')}
          </motion.h2>
          <motion.div className={styles.screenshotGrid} {...fadeUp}>
            {[1, 2, 3].map((num) => (
              <div key={num} className={styles.screenshotPlaceholder}>
                <DeviceMobile size={32} weight="thin" />
                <span className={styles.screenshotLabel}>
                  {t('download.screenshot', 'Screenshot')} {num}
                </span>
              </div>
            ))}
          </motion.div>
        </section>

        {/* CTA */}
        <motion.section className={styles.cta} {...fadeUp}>
          <h2 className={styles.ctaTitle}>
            {t('download.ctaTitle', 'Ready to get started?')}
          </h2>
          <p className={styles.ctaDesc}>
            {t(
              'download.ctaDesc',
              'Join thousands of Calgarians finding better local services.'
            )}
          </p>
          <Button variant="primary" size="lg" as="a" href="/signup">
            {t('common.signup', 'Sign Up Free')}
          </Button>
        </motion.section>
      </div>
    </>
  )
}
