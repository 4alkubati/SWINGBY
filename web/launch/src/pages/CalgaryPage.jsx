import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import Button from '../components/Button'
import styles from './page.module.css'

const NEIGHBOURHOODS = [
  'Beltline', 'Bridgeland', 'Capitol Hill', 'Crescent Heights', 'Inglewood',
  'Kensington', 'Mission', 'Montgomery', 'Mount Pleasant', 'Ramsay',
  'Sunnyside', 'Bankview', 'Altadore', 'Marda Loop', 'Garrison Woods',
  'Killarney', 'Glenbrook', 'Oakridge', 'Palliser', 'Pump Hill',
  'Cougar Ridge', 'Coach Hill', 'Aspen Woods', 'Signal Hill', 'Glamorgan',
  'Bowness', 'Montgomery', 'Valley Ridge', 'Tuscany', 'Scenic Acres',
  'Citadel', 'Hamptons', 'Nolan Hill', 'Evanston', 'Sage Hill',
  'Panorama Hills', 'Coventry Hills', 'Country Hills', 'Harvest Hills',
  'Sandstone Valley', 'Beddington', 'Thorncliffe', 'Hunterhorn',
  'Marlborough', 'Forest Heights', 'Temple', 'Rundle', 'Whitehorn',
  'Pineridge', 'Abbeydale', 'Radisson Heights', 'Dover', 'Riverbend',
  'Quarry Park', 'Mahogany', 'Auburn Bay', 'McKenzie Towne', 'Copperfield',
  'New Brighton', 'Cranston', 'Legacy', 'Silverado', 'Shawnessy',
]

const TOP_CATEGORIES = ['Cleaning', 'Plumbing', 'Electrical', 'Landscaping', 'Handyman']

export default function CalgaryPage() {
  return (
    <>
      <SEO
        title="Home services in Calgary, Alberta"
        description="Find vetted local service businesses across Calgary — cleaning, plumbing, electrical, landscaping, and more. SwingBy is live in Calgary."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: 'SwingBy',
          description: 'Local services marketplace in Calgary',
          areaServed: { '@type': 'City', name: 'Calgary', addressRegion: 'AB', addressCountry: 'CA' },
        }}
      />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Local services in Calgary</h1>
          <p className={styles.pageSubtitle}>
            SwingBy is live in Calgary, Alberta. Post a job and get quotes from vetted local businesses — across YYC.
          </p>
          <div style={{ marginTop: 'var(--space-xl)' }}>
            <Link to="/signup"><Button size="lg">Post a job in Calgary</Button></Link>
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Browse by service</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {TOP_CATEGORIES.map(c => (
              <Link key={c} to={`/categories/${c.toLowerCase()}`}>
                <Button variant="secondary">{c}</Button>
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Neighbourhoods we serve</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {NEIGHBOURHOODS.map(n => (
              <Link key={n} to={`/calgary/${n.toLowerCase().replace(/\s+/g, '-')}/cleaning`} style={{ fontSize: '14px', color: 'var(--color-accent-text)', padding: '6px 0', display: 'block' }}>
                {n}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
