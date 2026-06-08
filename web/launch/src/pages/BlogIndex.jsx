import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import SEO from '../components/SEO'
import { BLOG_POSTS } from '../data/blogPosts'
import styles from './page.module.css'

export default function BlogIndex() {
  return (
    <>
      <SEO title="Blog" description="SwingBy blog — product updates, guides for clients and businesses, and insights on the Calgary home services market." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Blog</h1>
          <p className={styles.pageSubtitle}>Product updates and insights from the SwingBy team.</p>
        </div>
        <div className={styles.section}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {BLOG_POSTS.map(post => (
              <Link key={post.slug} to={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
                <div className={styles.card} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'start', gap: 'var(--space-lg)' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-accent-text)', marginBottom: '6px', fontWeight: 600 }}>{post.category}</div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', color: 'var(--color-text-primary)', marginBottom: '8px' }}>{post.title}</h2>
                    <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{post.excerpt}</p>
                    <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {post.author.name} · {format(new Date(post.publishedAt), 'MMM d, yyyy')} · {post.readTime} min read
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
