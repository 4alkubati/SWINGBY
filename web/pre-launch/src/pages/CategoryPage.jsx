import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox, Tag, ArrowLeft } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import Breadcrumbs from '../components/Breadcrumbs'
import { FAQSection } from '../components/FAQItem'
import categories from '../data/categories.json'
import shared from './page.module.css'
import s from './CategoryPage.module.css'

const ICONS = { Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox }

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

export default function CategoryPage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const category = categories.find((c) => c.slug === slug)

  if (!category) {
    return (
      <>
        <SEO title={t('categoryPage.notFoundTitle')} description={t('categoryPage.notFoundDesc')} />
        <div className={shared.emptyState}>
          <h1 className={shared.emptyTitle}>{t('categoryPage.notFoundTitle')}</h1>
          <p className={shared.emptyDesc}>{t('categoryPage.notFoundDesc')}</p>
          <Link to="/categories">
            <Button variant="secondary">
              <ArrowLeft size={16} /> {t('categoryPage.browseAll')}
            </Button>
          </Link>
        </div>
      </>
    )
  }

  const Icon = ICONS[category.icon]
  const breadcrumbs = [
    { label: t('nav.home'), to: '/' },
    { label: t('nav.categories'), to: '/categories' },
    { label: category.name },
  ]

  return (
    <>
      <SEO
        title={`${category.name} Services`}
        description={`${category.tagline}. ${category.description} Average price: ${category.averagePrice}.`}
        og={{ url: `https://swingbyy.com/categories/${slug}` }}
      />

      <div className={s.container}>
        <motion.div {...fadeUp}>
          <Breadcrumbs items={breadcrumbs} className={s.breadcrumbs} />
        </motion.div>

        {/* Hero */}
        <motion.section className={s.hero} {...fadeUp}>
          <div className={s.heroIcon}>
            {Icon && <Icon size={40} weight="regular" />}
          </div>
          <h1 className={s.heroTitle}>{category.name}</h1>
          <p className={s.heroTagline}>{category.tagline}</p>
        </motion.section>

        {/* Description */}
        <motion.section className={s.descSection} {...fadeUp}>
          <p className={s.description}>{category.description}</p>
          <div className={s.priceBlock}>
            <Tag size={20} weight="bold" className={s.priceIcon} />
            <div>
              <span className={s.priceLabel}>{t('categoryPage.averagePrice')}</span>
              <span className={s.priceValue}>{category.averagePrice}</span>
            </div>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.div className={s.ctaRow} {...fadeUp}>
          <Link to="/signup">
            <Button size="lg">{t('categoryPage.getQuotes')}</Button>
          </Link>
        </motion.div>

        {/* FAQ */}
        {category.faqItems && category.faqItems.length > 0 && (
          <motion.section className={s.faqSection} {...fadeUp}>
            <h2 className={s.faqTitle}>{t('categoryPage.faqTitle')}</h2>
            <FAQSection items={category.faqItems} />
          </motion.section>
        )}
      </div>
    </>
  )
}
