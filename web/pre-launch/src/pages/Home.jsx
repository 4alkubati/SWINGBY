import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ArrowRight, Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import { FAQSection } from '../components/FAQItem'
import styles from './Home.module.css'

const CATEGORY_ICONS = { Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox }

const CATEGORIES = [
  { slug: 'cleaning', name: 'Cleaning', icon: 'Broom' },
  { slug: 'plumbing', name: 'Plumbing', icon: 'Wrench' },
  { slug: 'electrical', name: 'Electrical', icon: 'Lightning' },
  { slug: 'landscaping', name: 'Landscaping', icon: 'Plant' },
  { slug: 'painting', name: 'Painting', icon: 'PaintBrush' },
  { slug: 'carpentry', name: 'Carpentry', icon: 'Hammer' },
  { slug: 'handyman', name: 'Handyman', icon: 'Toolbox' },
]

const STEPS = [
  { num: '01', titleKey: 'home.step1Title', descKey: 'home.step1Desc' },
  { num: '02', titleKey: 'home.step2Title', descKey: 'home.step2Desc' },
  { num: '03', titleKey: 'home.step3Title', descKey: 'home.step3Desc' },
]


const FAQ_ITEMS = [
  { question: 'How does SwingByy work?', answer: 'Post a job describing what you need, receive competitive quotes from verified local businesses, compare ratings and prices, then book the best fit — all in one place.' },
  { question: 'Is SwingByy free for clients?', answer: 'Yes, posting jobs and receiving quotes is completely free. You only pay when you book a service.' },
  { question: 'How are businesses verified?', answer: 'Every business goes through a verification process including license checks, identity verification, and ongoing review monitoring.' },
  { question: 'What cities is SwingByy available in?', answer: 'We are currently launching in Calgary, Alberta with plans to expand across Canada.' },
  { question: 'How does payment work?', answer: 'Payments are held in escrow when you accept a quote. The money is released to the business when you approve the finished work — or automatically 24 hours after they mark it done. SwingByy keeps 10%.' },
]

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

export default function Home() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="Local Services Marketplace"
        description="Post a job, get quotes from verified businesses, and book the best pro in Calgary. Cleaning, plumbing, electrical, and more."
        og={{ image: '/og-image.png', url: 'https://swingbyy.com' }}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'SwingByy',
          url: 'https://swingbyy.com',
          description: 'Local services marketplace connecting clients with verified businesses in Calgary.',
        }}
      />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <motion.div className={styles.heroContent} {...fadeUp}>
          <h1 className={styles.heroTitle}>{t('home.heroTitle')}</h1>
          <p className={styles.heroSubtitle}>{t('home.heroSubtitle')}</p>
          <div className={styles.heroCtas}>
            <Link to="/download">
              <Button size="lg">{t('home.ctaGetApp')}</Button>
            </Link>
            <Link to="/for-businesses">
              <Button variant="secondary" size="lg">
                {t('home.ctaBusiness')} <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className={styles.section}>
        <motion.h2 className={styles.sectionTitle} {...fadeUp}>
          {t('home.howItWorksTitle')}
        </motion.h2>
        <div className={styles.stepsGrid}>
          {STEPS.map((step, i) => (
            <motion.div key={i} className={styles.stepCard} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
              <span className={styles.stepNum}>{step.num}</span>
              <h3 className={styles.stepTitle}>{t(step.titleKey)}</h3>
              <p className={styles.stepDesc}>{t(step.descKey)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className={styles.section}>
        <motion.h2 className={styles.sectionTitle} {...fadeUp}>
          {t('home.categoriesTitle')}
        </motion.h2>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.icon]
            return (
              <motion.div key={cat.slug} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.05 }}>
                <Link to={`/categories/${cat.slug}`} className={styles.categoryCard}>
                  {Icon && <Icon size={28} weight="regular" className={styles.categoryIcon} />}
                  <span className={styles.categoryName}>{cat.name}</span>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </section>



      {/* Cities */}
      <section className={styles.section}>
        <motion.h2 className={styles.sectionTitle} {...fadeUp}>
          {t('home.citiesTitle')}
        </motion.h2>
        <motion.div {...fadeUp}>
          <Link to="/cities/calgary" className={styles.cityCard}>
            <div className={styles.cityInfo}>
              <h3 className={styles.cityName}>Calgary, AB</h3>
              <p className={styles.cityDesc}>{t('citiesIndex.calgaryDesc')}</p>
            </div>
            <ArrowRight size={20} />
          </Link>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className={styles.section}>
        <motion.h2 className={styles.sectionTitle} {...fadeUp}>
          {t('home.faqTitle')}
        </motion.h2>
        <motion.div className={styles.faqWrap} {...fadeUp}>
          <FAQSection items={FAQ_ITEMS} />
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCta}>
        <motion.div className={styles.finalCtaContent} {...fadeUp}>
          <h2 className={styles.finalCtaTitle}>{t('home.finalCtaTitle')}</h2>
          <p className={styles.finalCtaSubtitle}>{t('home.finalCtaSubtitle')}</p>
          <div className={styles.heroCtas}>
            <Link to="/signup">
              <Button size="lg">{t('common.getStarted')}</Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </>
  )
}
