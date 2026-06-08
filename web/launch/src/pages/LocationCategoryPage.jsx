import { useParams, Link } from 'react-router-dom'
import SEO from '../components/SEO'
import Button from '../components/Button'
import styles from './page.module.css'

function titleCase(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function LocationCategoryPage() {
  const { neighbourhood, category } = useParams()
  const hood = titleCase(neighbourhood || '')
  const cat = titleCase(category || '')

  return (
    <>
      <SEO
        title={`${cat} in ${hood}, Calgary`}
        description={`Find vetted ${cat.toLowerCase()} businesses serving ${hood}, Calgary. Post a job on SwingBy and get competitive quotes.`}
      />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>{cat} in {hood}</h1>
          <p className={styles.pageSubtitle}>
            Find vetted {cat.toLowerCase()} professionals serving {hood}, Calgary.
            Post a job free, get competitive quotes, book with confidence.
          </p>
          <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup"><Button size="lg">Post a job free</Button></Link>
            <Link to="/calgary"><Button variant="secondary">Browse all Calgary</Button></Link>
          </div>
        </div>
      </div>
    </>
  )
}
