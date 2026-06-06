import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, CalendarBlank } from '@phosphor-icons/react'
import { format } from 'date-fns'
import SEO from '../components/SEO'
import Badge from '../components/Badge'
import Pagination from '../components/Pagination'
import styles from './BlogIndex.module.css'
import pageStyles from './page.module.css'
import { BLOG_POSTS } from '../data/blogPosts'

const POSTS_PER_PAGE = 4

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

export default function BlogIndex() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const featured = useMemo(
    () => BLOG_POSTS.find((p) => p.featured),
    []
  )

  const nonFeatured = useMemo(
    () => BLOG_POSTS.filter((p) => !p.featured),
    []
  )

  const totalPages = Math.ceil(nonFeatured.length / POSTS_PER_PAGE)
  const paginatedPosts = nonFeatured.slice(
    (page - 1) * POSTS_PER_PAGE,
    page * POSTS_PER_PAGE
  )

  return (
    <>
      <SEO
        title={t('blog.title', 'Blog')}
        description="Read the latest news, tips, and updates from SwingBy. Learn about local services, safety, and growing your business."
      />

      <div className={styles.page}>
        {/* Header */}
        <motion.section className={styles.header} {...fadeUp}>
          <h1 className={pageStyles.heroTitle}>{t('blog.title', 'Blog')}</h1>
          <p className={pageStyles.heroSubtitle}>
            {t(
              'blog.subtitle',
              'News, tips, and stories from the SwingBy community.'
            )}
          </p>
        </motion.section>

        {/* Featured Post */}
        {featured && (
          <motion.section className={styles.featured} {...fadeUp}>
            <Badge variant="accent" className={styles.featuredBadge}>
              {t('blog.featured', 'Featured')}
            </Badge>
            <Link to={`/blog/${featured.slug}`} className={styles.featuredCard}>
              <div className={styles.featuredCover}>
                <div className={styles.coverPlaceholder}>
                  <span className={styles.coverInitial}>
                    {featured.title.charAt(0)}
                  </span>
                </div>
              </div>
              <div className={styles.featuredBody}>
                <span className={styles.postCategory}>{featured.category}</span>
                <h2 className={styles.featuredTitle}>{featured.title}</h2>
                <p className={styles.featuredExcerpt}>{featured.excerpt}</p>
                <div className={styles.postMeta}>
                  <span className={styles.metaItem}>
                    <CalendarBlank size={14} />
                    {format(new Date(featured.publishedAt), 'MMM d, yyyy')}
                  </span>
                  <span className={styles.metaItem}>
                    <Clock size={14} />
                    {featured.readTime} {t('blog.minRead', 'min read')}
                  </span>
                </div>
                <span className={styles.readMore}>
                  {t('blog.readMore', 'Read more')}
                  <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          </motion.section>
        )}

        {/* Recent Posts Grid */}
        <section className={styles.recent}>
          <motion.h2 className={pageStyles.sectionTitle} {...fadeUp}>
            {t('blog.recent', 'Recent Posts')}
          </motion.h2>
          <div className={styles.postGrid}>
            {paginatedPosts.map((post, i) => (
              <motion.div
                key={post.slug}
                {...stagger}
                transition={{
                  duration: 0.4,
                  delay: i * 0.08,
                  ease: [0, 0, 0.2, 1],
                }}
              >
                <Link to={`/blog/${post.slug}`} className={styles.postCard}>
                  <div className={styles.postCover}>
                    <div className={styles.coverPlaceholder}>
                      <span className={styles.coverInitial}>
                        {post.title.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.postBody}>
                    <span className={styles.postCategory}>{post.category}</span>
                    <h3 className={styles.postTitle}>{post.title}</h3>
                    <p className={styles.postExcerpt}>{post.excerpt}</p>
                    <div className={styles.postMeta}>
                      <span className={styles.metaItem}>
                        <CalendarBlank size={14} />
                        {format(new Date(post.publishedAt), 'MMM d, yyyy')}
                      </span>
                      <span className={styles.metaItem}>
                        <Clock size={14} />
                        {post.readTime} {t('blog.minRead', 'min read')}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              className={styles.pagination}
            />
          )}
        </section>
      </div>
    </>
  )
}
