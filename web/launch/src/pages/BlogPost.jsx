import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { LinkedinLogo, TwitterLogo, LinkSimple } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import { BLOG_POSTS } from '../data/blogPosts'
import styles from './page.module.css'

function ShareButtons({ title, url }) {
  const encoded = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied.')).catch(() => toast.error('Copy failed.'))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'var(--space-2xl)', paddingTop: 'var(--space-xl)', borderTop: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginRight: '4px' }}>Share:</span>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--color-text-secondary)', textDecoration: 'none', fontWeight: 500 }}
      >
        <TwitterLogo size={15} /> X
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--color-text-secondary)', textDecoration: 'none', fontWeight: 500 }}
      >
        <LinkedinLogo size={15} /> LinkedIn
      </a>
      <button
        onClick={copyLink}
        aria-label="Copy link"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500, cursor: 'pointer' }}
      >
        <LinkSimple size={15} /> Copy link
      </button>
    </div>
  )
}

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
  const pageUrl = typeof window !== 'undefined' ? window.location.href : `https://swingby.ca/blog/${slug}`

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
          <ShareButtons title={post.title} url={pageUrl} />
        </div>
      </div>
    </>
  )
}
