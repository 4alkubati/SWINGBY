import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ArrowLeft } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { format } from 'date-fns'
import SEO from '../components/SEO'
import Button from '../components/Button'
import { BLOG_POSTS } from '../data/blogPosts'
import s from './BlogPost.module.css'

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

export default function BlogPost() {
  const { t } = useTranslation()
  const { slug } = useParams()
  const post = BLOG_POSTS.find((p) => p.slug === slug)

  if (!post) {
    return (
      <div className={s.page}>
        <div className={s.notFound}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>
            Post not found
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
            The blog post you're looking for doesn't exist.
          </p>
          <Link to="/blog"><Button variant="secondary">{t('common.back')} to Blog</Button></Link>
        </div>
      </div>
    )
  }

  const related = (post.relatedSlugs || []).map((s) => BLOG_POSTS.find((p) => p.slug === s)).filter(Boolean)

  return (
    <>
      <SEO
        title={`${post.title} — SwingBy Blog`}
        description={post.excerpt}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          author: { '@type': 'Person', name: post.author.name },
          datePublished: post.publishedAt,
        }}
      />
      <motion.div className={s.page} {...fadeUp}>
        <Link to="/blog" className={s.backLink}>
          <ArrowLeft size={16} /> {t('common.back')} to Blog
        </Link>

        <div className={s.meta}>
          <span className={s.category}>{post.category}</span>
          <span className={s.date}>{format(new Date(post.publishedAt), 'MMMM d, yyyy')}</span>
          <span className={s.readTime}>{post.readTime} min read</span>
        </div>

        <h1 className={s.title}>{post.title}</h1>

        <div className={s.authorRow}>
          <div className={s.authorAvatar}>{post.author.name[0]}</div>
          <div>
            <div className={s.authorName}>{post.author.name}</div>
            <div className={s.authorRole}>{post.author.role}</div>
          </div>
        </div>

        <div className={s.content}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>

        {related.length > 0 && (
          <div className={s.related}>
            <h2 className={s.relatedTitle}>{t('blog.relatedPosts')}</h2>
            <div className={s.relatedGrid}>
              {related.map((r) => (
                <Link key={r.slug} to={`/blog/${r.slug}`} className={s.relatedCard}>
                  <h3>{r.title}</h3>
                  <p>{r.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </>
  )
}
