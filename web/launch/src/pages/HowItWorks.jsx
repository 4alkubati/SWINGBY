import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import Button from '../components/Button'
import styles from './page.module.css'

const CLIENT_STEPS = [
  { n: '01', title: 'Post your job', desc: 'Describe what you need, set a budget, and pick your neighbourhood. No account required to browse — sign up to post.' },
  { n: '02', title: 'Receive quotes', desc: 'Verified businesses express interest and send their quoted price. You see their profile, ratings, and past reviews.' },
  { n: '03', title: 'Pick your pro', desc: 'Compare quotes and accept the one that fits your budget and timeline. The business confirms details.' },
  { n: '04', title: 'Pay safely', desc: 'Your payment is held in escrow. 50% releases when you confirm the booking, 50% on job completion.' },
  { n: '05', title: 'Leave a review', desc: 'Your honest review helps the next person make a great choice.' },
]

const BIZ_STEPS = [
  { n: '01', title: 'Create your listing', desc: 'Set up your business profile — category, service area, photos, description. Free forever.' },
  { n: '02', title: 'Browse open jobs', desc: 'See jobs posted near you that match your category. Geo-browse shows who\'s searching in your area.' },
  { n: '03', title: 'Express interest', desc: 'Send a quote with your price and a short note. No spam — clients only see expressions of interest, not contact details.' },
  { n: '04', title: 'Client accepts', desc: 'When a client picks you, a booking is created. You confirm the date and assign an employee if needed.' },
  { n: '05', title: 'Complete and earn', desc: 'Complete the job, mark it done in the app. 50% of the escrow is released immediately. A 10% platform fee applies.' },
]

export default function HowItWorks() {
  return (
    <>
      <SEO title="How it works" description="See how SwingBy works for clients and businesses — from posting a job to getting paid." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>How SwingBy works</h1>
          <p className={styles.pageSubtitle}>Two sides, one platform. Simple on both ends.</p>
        </div>

        <div className={styles.section}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
            <div>
              <h2 className={styles.sectionTitle}>For clients</h2>
              {CLIENT_STEPS.map((s) => (
                <div key={s.n} className={styles.card} style={{ marginBottom: '16px', display: 'flex', gap: '16px', padding: '20px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--color-accent-muted)', flexShrink: 0 }}>{s.n}</span>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>{s.title}</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
              <Link to="/signup"><Button>Post a job free</Button></Link>
            </div>

            <div>
              <h2 className={styles.sectionTitle}>For businesses</h2>
              {BIZ_STEPS.map((s) => (
                <div key={s.n} className={styles.card} style={{ marginBottom: '16px', display: 'flex', gap: '16px', padding: '20px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--color-accent-muted)', flexShrink: 0 }}>{s.n}</span>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>{s.title}</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
              <Link to="/signup"><Button>List your business free</Button></Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
