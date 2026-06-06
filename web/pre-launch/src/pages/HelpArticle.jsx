import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ThumbsUp, ThumbsDown, ArrowRight } from '@phosphor-icons/react'
import { useState } from 'react'
import SEO from '../components/SEO'
import Breadcrumbs from '../components/Breadcrumbs'
import Button from '../components/Button'
import styles from './HelpArticle.module.css'
import { HELP_ARTICLES } from '../data/helpArticles'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

export default function HelpArticle() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState(null) // 'yes' | 'no' | null

  const article = useMemo(
    () => HELP_ARTICLES.find((a) => a.slug === slug),
    [slug]
  )

  const relatedArticles = useMemo(() => {
    if (!article) return []
    return (article.relatedSlugs || [])
      .map((s) => HELP_ARTICLES.find((a) => a.slug === s))
      .filter(Boolean)
  }, [article])

  // 404 if article not found
  if (!article) {
    return (
      <>
        <SEO
          title={t('errors.notFound', 'Page not found')}
          description="This help article could not be found."
        />
        <div className={styles.notFound}>
          <motion.div className={styles.notFoundContent} {...fadeUp}>
            <h1 className={styles.notFoundTitle}>
              {t('errors.notFound', 'Article not found')}
            </h1>
            <p className={styles.notFoundDesc}>
              {t(
                'help.articleNotFound',
                'The help article you are looking for does not exist or has been moved.'
              )}
            </p>
            <Button variant="secondary" as={Link} to="/help">
              {t('help.backToHelp', 'Back to Help Center')}
            </Button>
          </motion.div>
        </div>
      </>
    )
  }

  const breadcrumbs = [
    { label: t('nav.home', 'Home'), to: '/' },
    { label: t('help.title', 'Help Center'), to: '/help' },
    { label: article.title },
  ]

  return (
    <>
      <SEO
        title={article.title}
        description={`Help article: ${article.title}. Learn more about ${article.category} on SwingBy.`}
      />

      <div className={styles.page}>
        <motion.div className={styles.breadcrumbWrap} {...fadeUp}>
          <Breadcrumbs items={breadcrumbs} />
        </motion.div>

        <div className={styles.layout}>
          {/* Main Content */}
          <motion.article
            className={styles.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0, 0, 0.2, 1] }}
          >
            <span className={styles.category}>
              {article.category.replace(/-/g, ' ')}
            </span>

            <div className={styles.markdown}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {article.content}
              </ReactMarkdown>
            </div>

            {/* Feedback */}
            <div className={styles.feedback}>
              <p className={styles.feedbackLabel}>
                {t('help.wasHelpful', 'Was this helpful?')}
              </p>
              <div className={styles.feedbackButtons}>
                <button
                  className={`${styles.feedbackBtn} ${feedback === 'yes' ? styles.feedbackActive : ''}`}
                  onClick={() => setFeedback('yes')}
                  aria-label="Yes, this was helpful"
                  disabled={feedback !== null}
                >
                  <ThumbsUp size={18} weight={feedback === 'yes' ? 'fill' : 'regular'} />
                  {t('help.yes', 'Yes')}
                </button>
                <button
                  className={`${styles.feedbackBtn} ${feedback === 'no' ? styles.feedbackActive : ''}`}
                  onClick={() => setFeedback('no')}
                  aria-label="No, this was not helpful"
                  disabled={feedback !== null}
                >
                  <ThumbsDown size={18} weight={feedback === 'no' ? 'fill' : 'regular'} />
                  {t('help.no', 'No')}
                </button>
              </div>
              {feedback && (
                <p className={styles.feedbackThanks}>
                  {t('help.thanksFeedback', 'Thanks for your feedback!')}
                </p>
              )}
            </div>
          </motion.article>

          {/* Sidebar */}
          <motion.aside
            className={styles.sidebar}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0, 0, 0.2, 1] }}
          >
            <h3 className={styles.sidebarTitle}>
              {t('help.relatedArticles', 'Related Articles')}
            </h3>
            <div className={styles.relatedList}>
              {relatedArticles.length > 0 ? (
                relatedArticles.map((related) => (
                  <Link
                    key={related.slug}
                    to={`/help/${related.slug}`}
                    className={styles.relatedItem}
                  >
                    <span className={styles.relatedText}>{related.title}</span>
                    <ArrowRight size={14} className={styles.relatedArrow} />
                  </Link>
                ))
              ) : (
                <p className={styles.noRelated}>
                  {t('help.noRelated', 'No related articles.')}
                </p>
              )}
            </div>

            <div className={styles.sidebarCta}>
              <p className={styles.sidebarCtaText}>
                {t('help.stillNeedHelp', 'Still need help?')}
              </p>
              <Link to="/contact" className={styles.sidebarCtaLink}>
                {t('help.contactUs', 'Contact Support')}
                <ArrowRight size={14} />
              </Link>
            </div>
          </motion.aside>
        </div>
      </div>
    </>
  )
}
