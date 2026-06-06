import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Check, X } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import { FAQSection } from '../components/FAQItem'
import shared from './page.module.css'
import s from './Pricing.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

const COMPARISON_ROWS = [
  { featureKey: 'pricing.postJobs', client: 'check', business: 'na' },
  { featureKey: 'pricing.receiveQuotes', client: 'check', business: 'na' },
  { featureKey: 'pricing.bookServices', client: 'check', business: 'na' },
  { featureKey: 'pricing.inAppMessaging', client: 'check', business: 'check' },
  { featureKey: 'pricing.reviewsRatings', client: 'check', business: 'check' },
  { featureKey: 'pricing.platformAccess', client: 'freeLabel', business: 'freeLabel' },
  { featureKey: 'pricing.perJobFee', client: 'freeLabel', business: 'tenPercent' },
]

const FAQ_ITEMS_KEYS = [
  { qKey: 'pricing.faq1Q', aKey: 'pricing.faq1A' },
  { qKey: 'pricing.faq2Q', aKey: 'pricing.faq2A' },
  { qKey: 'pricing.faq3Q', aKey: 'pricing.faq3A' },
  { qKey: 'pricing.faq4Q', aKey: 'pricing.faq4A' },
]

function CellContent({ type, t }) {
  switch (type) {
    case 'check':
      return <Check size={20} weight="bold" className={s.checkIcon} />
    case 'na':
      return <X size={18} weight="regular" className={s.naIcon} />
    case 'freeLabel':
      return <span className={s.freeLabel}>{t('pricing.free')}</span>
    case 'tenPercent':
      return <span className={s.feeLabel}>{t('pricing.tenPercent')}</span>
    default:
      return null
  }
}

export default function Pricing() {
  const { t } = useTranslation()

  const faqItems = FAQ_ITEMS_KEYS.map((faq) => ({
    question: t(faq.qKey),
    answer: t(faq.aKey),
  }))

  return (
    <>
      <SEO
        title={t('pricing.title')}
        description="SwingBy pricing: free for clients, 10% platform fee for businesses. No monthly fees, no hidden costs."
        og={{ url: 'https://swingbyy.com/pricing' }}
      />

      {/* Hero */}
      <section className={shared.heroSection}>
        <motion.div {...fadeUp}>
          <h1 className={shared.heroTitle}>{t('pricing.title')}</h1>
          <p className={shared.heroSubtitle}>{t('pricing.subtitle')}</p>
        </motion.div>
      </section>

      {/* Pricing Cards */}
      <div className={s.container}>
        <div className={s.pricingCards}>
          <motion.div className={s.pricingCard} {...fadeUp}>
            <div className={s.cardHeader}>
              <h3 className={s.cardPlan}>{t('pricing.freeForClients')}</h3>
              <span className={s.cardPrice}>$0</span>
            </div>
            <p className={s.cardDesc}>{t('pricing.freeForClientsDesc')}</p>
            <ul className={s.cardFeatures}>
              <li><Check size={16} weight="bold" className={s.featureCheck} /> {t('pricing.postJobs')}</li>
              <li><Check size={16} weight="bold" className={s.featureCheck} /> {t('pricing.receiveQuotes')}</li>
              <li><Check size={16} weight="bold" className={s.featureCheck} /> {t('pricing.bookServices')}</li>
              <li><Check size={16} weight="bold" className={s.featureCheck} /> {t('pricing.inAppMessaging')}</li>
            </ul>
            <Link to="/signup">
              <Button variant="secondary" className={s.cardBtn}>{t('common.getStarted')}</Button>
            </Link>
          </motion.div>

          <motion.div className={`${s.pricingCard} ${s.pricingCardFeatured}`} {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
            <div className={s.cardHeader}>
              <h3 className={s.cardPlan}>{t('pricing.forBusinesses')}</h3>
              <span className={s.cardPrice}>10%</span>
            </div>
            <p className={s.cardDesc}>{t('pricing.forBusinessesDesc')}</p>
            <ul className={s.cardFeatures}>
              <li><Check size={16} weight="bold" className={s.featureCheck} /> {t('pricing.noMonthlyFee')}</li>
              <li><Check size={16} weight="bold" className={s.featureCheck} /> {t('pricing.noSignupFee')}</li>
              <li><Check size={16} weight="bold" className={s.featureCheck} /> {t('pricing.noHiddenFees')}</li>
              <li><Check size={16} weight="bold" className={s.featureCheck} /> {t('pricing.reviewsRatings')}</li>
            </ul>
            <Link to="/signup">
              <Button className={s.cardBtn}>{t('common.getStarted')}</Button>
            </Link>
          </motion.div>
        </div>

        {/* Comparison Table */}
        <motion.div className={s.tableSection} {...fadeUp}>
          <h2 className={s.tableSectionTitle}>{t('pricing.comparisonTitle')}</h2>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('pricing.featureCol')}</th>
                  <th>{t('pricing.clientCol')}</th>
                  <th>{t('pricing.businessCol')}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i}>
                    <td>{t(row.featureKey)}</td>
                    <td><CellContent type={row.client} t={t} /></td>
                    <td><CellContent type={row.business} t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div className={s.faqSection} {...fadeUp}>
          <h2 className={s.tableSectionTitle}>{t('pricing.faqTitle')}</h2>
          <div className={s.faqWrap}>
            <FAQSection items={faqItems} />
          </div>
        </motion.div>
      </div>
    </>
  )
}
