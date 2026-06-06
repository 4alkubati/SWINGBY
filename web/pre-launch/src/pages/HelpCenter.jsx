import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  MagnifyingGlass,
  RocketLaunch,
  CalendarCheck,
  CreditCard,
  UserCircle,
  ShieldCheck,
  ArrowRight,
  BookOpen,
} from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Input from '../components/Input'
import styles from './HelpCenter.module.css'
import pageStyles from './page.module.css'
import { HELP_CATEGORIES, HELP_ARTICLES } from '../data/helpArticles'

const CATEGORY_ICONS = {
  RocketLaunch,
  CalendarCheck,
  CreditCard,
  UserCircle,
  ShieldCheck,
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

const stagger = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-30px' },
}

export default function HelpCenter() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const popularArticles = useMemo(
    () => HELP_ARTICLES.filter((a) => a.popular),
    []
  )

  const filteredArticles = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return HELP_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    )
  }, [query])

  return (
    <>
      <SEO
        title={t('help.title', 'Help Center')}
        description="Find answers to common questions about SwingBy. Browse help articles on bookings, payments, account settings, and more."
      />

      <div className={styles.page}>
        {/* Hero / Search */}
        <motion.section className={styles.hero} {...fadeUp}>
          <h1 className={pageStyles.heroTitle}>
            {t('help.title', 'Help Center')}
          </h1>
          <p className={pageStyles.heroSubtitle}>
            {t(
              'help.subtitle',
              'Find answers to your questions or browse by topic.'
            )}
          </p>
          <div className={styles.searchWrap}>
            <Input
              label={t('help.searchPlaceholder', 'Search for help...')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              prefix={<MagnifyingGlass size={18} />}
              aria-label={t('help.searchPlaceholder', 'Search for help...')}
            />
          </div>

          {/* Search results dropdown */}
          {query.trim() && (
            <div className={styles.searchResults} role="listbox">
              {filteredArticles.length > 0 ? (
                filteredArticles.map((article) => (
                  <Link
                    key={article.slug}
                    to={`/help/${article.slug}`}
                    className={styles.searchResult}
                    role="option"
                  >
                    <BookOpen size={16} />
                    <span>{article.title}</span>
                    <ArrowRight size={14} className={styles.searchResultArrow} />
                  </Link>
                ))
              ) : (
                <div className={styles.searchEmpty}>
                  {t('help.noResults', 'No articles found for "{{query}}"', {
                    query,
                  })}
                </div>
              )}
            </div>
          )}
        </motion.section>

        {/* Categories */}
        <section className={styles.categories}>
          <motion.h2 className={pageStyles.sectionTitle} {...fadeUp}>
            {t('help.browseTopics', 'Browse by topic')}
          </motion.h2>
          <div className={styles.categoryGrid}>
            {HELP_CATEGORIES.map((cat, i) => {
              const Icon = CATEGORY_ICONS[cat.icon]
              return (
                <motion.div
                  key={cat.key}
                  className={styles.categoryCard}
                  {...stagger}
                  transition={{
                    duration: 0.4,
                    delay: i * 0.08,
                    ease: [0, 0, 0.2, 1],
                  }}
                >
                  <div className={styles.categoryIcon}>
                    {Icon && <Icon size={24} weight="duotone" />}
                  </div>
                  <h3 className={styles.categoryTitle}>
                    {t(cat.titleKey, cat.key)}
                  </h3>
                  <p className={styles.categoryDesc}>{cat.description}</p>
                  <span className={styles.categoryCount}>
                    {cat.count} {t('help.articles', 'articles')}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Popular Articles */}
        <section className={styles.popular}>
          <motion.h2 className={pageStyles.sectionTitle} {...fadeUp}>
            {t('help.popular', 'Popular Articles')}
          </motion.h2>
          <div className={styles.articleList}>
            {popularArticles.map((article, i) => (
              <motion.div
                key={article.slug}
                {...stagger}
                transition={{
                  duration: 0.4,
                  delay: i * 0.06,
                  ease: [0, 0, 0.2, 1],
                }}
              >
                <Link
                  to={`/help/${article.slug}`}
                  className={styles.articleItem}
                >
                  <div className={styles.articleInfo}>
                    <span className={styles.articleCategory}>
                      {article.category.replace(/-/g, ' ')}
                    </span>
                    <h3 className={styles.articleTitle}>{article.title}</h3>
                  </div>
                  <ArrowRight size={18} className={styles.articleArrow} />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Contact CTA */}
        <motion.section className={styles.contactCta} {...fadeUp}>
          <h3 className={styles.contactTitle}>
            {t('help.stillNeedHelp', 'Still need help?')}
          </h3>
          <p className={styles.contactDesc}>
            {t(
              'help.contactDesc',
              'Our support team is available to help you with any questions.'
            )}
          </p>
          <Link to="/contact" className={styles.contactLink}>
            {t('help.contactUs', 'Contact Support')}
            <ArrowRight size={16} />
          </Link>
        </motion.section>
      </div>
    </>
  )
}
