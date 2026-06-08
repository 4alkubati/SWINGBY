import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import SEO from '../components/SEO'
import { BLOG_POSTS } from '../data/blogPosts'
import styles from './page.module.css'

export default function BlogPost() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find(p => p.slug === slug)

  if (!post) {
    return (
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Post not found</h1>
          <Link to="/blog" style={{ color: 'var(--color-accent-text)' }}>Back to blog</Link>
        </div>
      </div>
    )
  }

  const paragraphs = post.content.split('\n\n').filter(Boolean)

  return (
    <>
      <SEO title={post.title} description={post.excerpt} />
      <div className={styles.container}>
        <div style={{ padding: 'var(--space-lg) 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <Link to="/blog" style={{ color: 'var(--color-accent-text)' }}>Blog</Link> / {post.category}
        </div>
        <div style={{ maxWidth: '720px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-accent-text)', marginBottom: '12px', fontWeight: 600 }}>{post.category}</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(28px, 4vw, 40px)', color: 'var(--color-text-primary)', lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 'var(--space-base)' }}>{post.title}</h1>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2xl)' }}>
            {post.author.name} · {format(new Date(post.publishedAt), 'MMMM d, yyyy')} · {post.readTime} min read
          </div>
          <div className={styles.prose}>
            {paragraphs.map((p, i) => {
              if (p.startsWith('## ')) return <h2 key={i}>{p.replace('## ', '')}</h2>
              if (p.startsWith('### ')) return <h3 key={i}>{p.replace('### ', '')}</h3>
              if (p.startsWith('- ')) return <ul key={i}>{p.split('\n').filter(Boolean).map((li, j) => <li key={j}>{li.replace('- ', '')}</li>)}</ul>
              if (p.startsWith('1. ')) return <ul key={i}>{p.split('\n').filter(Boolean).map((li, j) => <li key={j}>{li.replace(/^\d+\.\s/, '')}</li>)}</ul>
              return <p key={i}>{p}</p>
            })}
          </div>
        </div>
      </div>
    </>
  )
}
