import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlass } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import { useDebounce } from '../hooks/useDebounce'
import { HELP_CATEGORIES, HELP_ARTICLES } from '../data/helpArticles'
import styles from './page.module.css'

export default function HelpCenter() {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 200)

  const results = debounced
    ? HELP_ARTICLES.filter(a => a.title.toLowerCase().includes(debounced.toLowerCase()))
    : null

  return (
    <>
      <SEO title="Help center" description="Find answers about SwingBy — bookings, payments, accounts, and more." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Help center</h1>
          <div style={{ maxWidth: '480px', margin: '24px auto 0', position: 'relative' }}>
            <MagnifyingGlass size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
            <input
              type="search"
              placeholder="Search help articles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 44px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', fontSize: '15px' }}
            />
          </div>
        </div>

        {results ? (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Search results ({results.length})</h2>
            {results.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)' }}>No articles found for "{debounced}".</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {results.map(a => (
                  <Link key={a.slug} to={`/help/${a.slug}`} style={{ display: 'block', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px 20px', color: 'var(--color-text-primary)' }}>
                    <strong>{a.title}</strong>
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{a.category}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.section}>
            <div className={styles.grid3}>
              {HELP_CATEGORIES.map(c => (
                <div key={c.key} className={styles.card}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>{c.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>{c.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {HELP_ARTICLES.filter(a => a.category === c.key).map(a => (
                      <Link key={a.slug} to={`/help/${a.slug}`} style={{ fontSize: '13px', color: 'var(--color-accent-text)' }}>{a.title}</Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          Can't find what you're looking for? <Link to="/contact" style={{ color: 'var(--color-accent-text)' }}>Contact support</Link>
        </div>
      </div>
    </>
  )
}
