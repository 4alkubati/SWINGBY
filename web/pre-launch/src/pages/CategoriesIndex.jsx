import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox, ArrowRight } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import categories from '../data/categories.json'
import shared from './page.module.css'
import s from './CategoriesIndex.module.css'

const ICONS = { Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox }

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

export default function CategoriesIndex() {
  const { t } = useTranslation()

  return (
    <>
      <SEO
        title="Browse Categories"
        description="Find local professionals for cleaning, plumbing, electrical, landscaping, painting, carpentry, and handyman services in Calgary."
        og={{ url: 'https://swingbyy.com/categories' }}
      />

      <section className={shared.heroSection}>
        <motion.div {...fadeUp}>
          <h1 className={shared.heroTitle}>{t('categoriesIndex.heroTitle')}</h1>
          <p className={shared.heroSubtitle}>{t('categoriesIndex.heroSubtitle')}</p>
        </motion.div>
      </section>

      <div className={s.container}>
        <div className={s.grid}>
          {categories.map((cat, i) => {
            const Icon = ICONS[cat.icon]
            return (
              <motion.div
                key={cat.slug}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.06 }}
              >
                <Link to={`/categories/${cat.slug}`} className={s.card}>
                  <div className={s.cardIcon}>
                    {Icon && <Icon size={32} weight="regular" />}
                  </div>
                  <div className={s.cardBody}>
                    <h3 className={s.cardName}>{cat.name}</h3>
                    <p className={s.cardTagline}>{cat.tagline}</p>
                  </div>
                  <ArrowRight size={18} className={s.cardArrow} />
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </>
  )
}
