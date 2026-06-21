import { useParams, Link } from 'react-router-dom'
import SEO from '../components/SEO'
import Button from '../components/Button'
import NotFound from './NotFound'
import { getSeoContent } from '../data/seo-content'
import { findNeighbourhood } from '../data/neighbourhoods'
import styles from './page.module.css'

function titleCase(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function LocationCategoryPage() {
  const { neighbourhood, category } = useParams()
  const hood = titleCase(neighbourhood || '')
  const cat = titleCase(category || '')

  const content = getSeoContent(neighbourhood, category)
  const hoodData = findNeighbourhood(neighbourhood)

  if (!content) return <NotFound />

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${cat} in ${hood}, Calgary`,
    description: content.intro.slice(0, 160),
    provider: {
      '@type': 'Organization',
      name: 'SwingBy',
      url: 'https://swingbyy.com',
      areaServed: {
        '@type': 'Place',
        name: `${hood}, Calgary, AB`,
      },
    },
    serviceType: cat,
    areaServed: {
      '@type': 'Place',
      name: `${hood}, Calgary, Alberta, Canada`,
    },
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <>
      <SEO
        title={`${cat} in ${hood}, Calgary`}
        description={`Find vetted ${cat.toLowerCase()} businesses serving ${hood}, Calgary. Post a job on SwingBy and get competitive quotes.`}
        jsonLd={[jsonLd, faqSchema]}
      />
      <div className={styles.container}>
        {/* Breadcrumb */}
        <div style={{ padding: 'var(--space-lg) 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <Link to="/calgary" style={{ color: 'var(--color-accent-text)' }}>Calgary</Link>
          {' / '}
          <span>{hood}</span>
          {' / '}
          <span>{cat}</span>
        </div>

        {/* Hero */}
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>{cat} in {hood}</h1>
          {hoodData && (
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>{hoodData.description}</p>
          )}
          <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup"><Button size="lg">{content.cta}</Button></Link>
            <Link to="/calgary"><Button variant="secondary">Browse all Calgary</Button></Link>
          </div>
        </div>

        {/* 200-word intro */}
        <div className={styles.section} style={{ maxWidth: '720px' }}>
          <p style={{ fontSize: '16px', lineHeight: 1.75, color: 'var(--color-text-secondary)' }}>{content.intro}</p>
        </div>

        {/* FAQs */}
        <div className={styles.section} style={{ maxWidth: '720px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-lg)' }}>
            Frequently asked questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {content.faqs.map(({ q, a }, i) => (
              <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px', color: 'var(--color-text-primary)', marginBottom: '8px' }}>{q}</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl) 0' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-base)' }}>
            Ready to find a trusted {cat.toLowerCase()} business in {hood}?
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', fontSize: '15px' }}>Post your job free. Get quotes from verified local businesses. Book with confidence.</p>
          <Link to="/signup"><Button size="lg">{content.cta}</Button></Link>
        </div>
      </div>
    </>
  )
}
