import { useParams, Link } from 'react-router-dom'
import SEO from '../components/SEO'
import { HELP_ARTICLES } from '../data/helpArticles'
import styles from './page.module.css'

export default function HelpArticle() {
  const { slug } = useParams()
  const article = HELP_ARTICLES.find(a => a.slug === slug)

  if (!article) {
    return (
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Article not found</h1>
          <Link to="/help" style={{ color: 'var(--color-accent-text)' }}>Back to help center</Link>
        </div>
      </div>
    )
  }

  const paragraphs = article.content.split('\n\n').filter(Boolean)

  return (
    <>
      <SEO title={article.title} description={article.title} />
      <div className={styles.container}>
        <div style={{ padding: 'var(--space-lg) 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <Link to="/help" style={{ color: 'var(--color-accent-text)' }}>Help center</Link> / {article.title}
        </div>
        <div style={{ maxWidth: '720px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '36px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-xl)' }}>{article.title}</h1>
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
