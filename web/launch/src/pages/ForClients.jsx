import { Link } from 'react-router-dom'
import { Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox, ArrowRight } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import styles from './page.module.css'

const CATEGORIES = [
  { slug: 'cleaning', name: 'Cleaning', Icon: Broom, desc: 'House, apartment, and office cleaning. Regular or one-time.' },
  { slug: 'plumbing', name: 'Plumbing', Icon: Wrench, desc: 'Leaks, installs, hot water tanks, drain work.' },
  { slug: 'electrical', name: 'Electrical', Icon: Lightning, desc: 'Panel upgrades, outlets, lighting, EV chargers.' },
  { slug: 'landscaping', name: 'Landscaping', Icon: Plant, desc: 'Lawn care, snow removal, garden design.' },
  { slug: 'painting', name: 'Painting', Icon: PaintBrush, desc: 'Interior, exterior, cabinet refinishing.' },
  { slug: 'carpentry', name: 'Carpentry', Icon: Hammer, desc: 'Custom builds, furniture, trim, decking.' },
  { slug: 'handyman', name: 'Handyman', Icon: Toolbox, desc: 'Small repairs, installations, odd jobs.' },
]

export default function ForClients() {
  return (
    <>
      <SEO title="For clients" description="Post any home service job and get competitive quotes from vetted local businesses in Calgary. Free for clients, always." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Find the right pro, fast</h1>
          <p className={styles.pageSubtitle}>
            Post your job in two minutes. Get quotes from vetted local businesses.
            Book with escrow-protected payments. Free for clients, always.
          </p>
          <div style={{ marginTop: 'var(--space-xl)' }}>
            <Link to="/signup"><Button size="lg">Post a job free</Button></Link>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>What can you book?</h2>
          <div className={styles.grid3}>
            {CATEGORIES.map(({ slug, name, Icon, desc }) => (
              <Link key={slug} to={`/categories/${slug}`} style={{ textDecoration: 'none' }}>
                <div className={styles.card} style={{ cursor: 'pointer', transition: 'border-color 0.2s', hover: { borderColor: 'var(--color-accent)' } }}>
                  <div style={{ color: 'var(--color-accent-text)', marginBottom: '12px' }}><Icon size={32} weight="duotone" /></div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>{name}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.section} style={{ textAlign: 'center' }}>
          <h2 className={styles.sectionTitle}>Why clients choose SwingBy</h2>
          <div className={styles.grid3}>
            {[
              { title: 'Always free', desc: 'Posting jobs and receiving quotes costs nothing. You pay the agreed price to the business — SwingBy never charges clients a service fee.' },
              { title: 'Real competition', desc: 'Multiple businesses quote on your job. You compare prices, reviews, and timelines. Not one provider, not a forced match — your choice.' },
              { title: 'Protected payment', desc: 'Your money is held safely in escrow. Released when work is done to your satisfaction. Dispute protection if something goes wrong.' },
            ].map(({ title, desc }) => (
              <div key={title} className={styles.card}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: 'var(--space-3xl) 0' }}>
          <Link to="/how-it-works">
            <Button variant="secondary" size="lg">
              See exactly how it works <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}
