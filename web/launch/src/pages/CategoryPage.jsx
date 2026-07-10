import { useParams, Link } from 'react-router-dom'
import SEO from '../components/SEO'
import Button from '../components/Button'
import styles from './page.module.css'
import { CATEGORIES } from './CategoriesIndex'

export default function CategoryPage() {
  const { slug } = useParams()
  const cat = CATEGORIES.find(c => c.slug === slug)

  if (!cat) {
    return (
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Category not found</h1>
          <Link to="/categories"><Button variant="secondary">Browse all categories</Button></Link>
        </div>
      </div>
    )
  }

  const { name, Icon, desc } = cat

  return (
    <>
      <SEO
        title={`${name} services in Calgary`}
        description={`Find vetted ${name.toLowerCase()} businesses in Calgary on SwingBy. Post a job, get quotes, book with confidence.`}
      />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <div style={{ color: 'var(--color-accent-text)', marginBottom: '16px' }}><Icon size={48} weight="regular" /></div>
          <h1 className={styles.pageTitle}>{name} in Calgary</h1>
          <p className={styles.pageSubtitle}>{desc}. Find and book vetted local providers on SwingBy.</p>
          <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup"><Button size="lg">Post a {name.toLowerCase()} job free</Button></Link>
            <Link to="/calgary"><Button variant="secondary" size="lg">Browse Calgary</Button></Link>
          </div>
        </div>
        <div className={styles.section} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <p>SwingBy is launching in Calgary. Sign up to be first to see verified {name.toLowerCase()} businesses near you.</p>
        </div>
      </div>
    </>
  )
}
