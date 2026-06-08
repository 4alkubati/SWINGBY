import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, ArrowRight } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import styles from './page.module.css'

export default function ForBusinesses() {
  const [hours, setHours] = useState(20)
  const [rate, setRate] = useState(80)
  const jobs = Math.round((hours * 4) / 2)
  const grossPerMonth = hours * 4 * rate
  const platformFee = grossPerMonth * 0.05
  const netPerMonth = grossPerMonth - platformFee

  return (
    <>
      <SEO title="For businesses" description="List your service business on SwingBy. Free signup, 10% fee on completion only. Grow your client base in Calgary." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>More bookings. Less cold-calling.</h1>
          <p className={styles.pageSubtitle}>
            List your business for free. Get job leads from local clients.
            Pay only when you earn — 10% on completed bookings.
          </p>
          <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup"><Button size="lg">List your business free</Button></Link>
            <Link to="/pricing"><Button variant="secondary" size="lg">See pricing</Button></Link>
          </div>
        </div>

        {/* Value calculator */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2xl)', marginBottom: 'var(--space-3xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Calculator size={28} weight="duotone" color="var(--color-accent-text)" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '24px', color: 'var(--color-text-primary)' }}>What could SwingBy earn you?</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>Hours per week available</label>
              <input type="range" min="5" max="60" value={hours} onChange={e => setHours(Number(e.target.value))} style={{ width: '100%' }} />
              <p style={{ color: 'var(--color-accent-text)', fontWeight: 700, marginTop: '4px' }}>{hours} hrs/week</p>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>Your hourly rate ($)</label>
              <input type="range" min="30" max="250" step="5" value={rate} onChange={e => setRate(Number(e.target.value))} style={{ width: '100%' }} />
              <p style={{ color: 'var(--color-accent-text)', fontWeight: 700, marginTop: '4px' }}>${rate}/hr</p>
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-xl)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)' }}>
            {[
              { label: 'Potential jobs/month', value: jobs },
              { label: 'Gross revenue/month', value: `$${grossPerMonth.toLocaleString()}` },
              { label: 'Net after 5% launch fee', value: `$${netPerMonth.toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center', background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--color-text-primary)' }}>{value}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{label}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-base)' }}>
            Estimate based on founder pricing (5% fee for first 100 businesses). Standard rate is 10%.
          </p>
        </div>

        {/* Benefits */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Why businesses use SwingBy</h2>
          <div className={styles.grid3}>
            {[
              { title: 'Warm leads, not cold calls', desc: 'Clients post jobs with a budget and timeline. You only quote on jobs that match your service area and category.' },
              { title: 'Free until you earn', desc: 'Signup is free. Listing is free. You pay 10% (5% on launch pricing) only when a booking completes.' },
              { title: 'Your reputation, protected', desc: 'Reviews come only from verified bookings. No anonymous reviews. Respond publicly to build trust.' },
              { title: 'Escrow, not chasing invoices', desc: 'Payment is collected when the booking is created. No more "the cheque is in the mail."' },
              { title: 'Manage your team', desc: 'Add employees, assign them to bookings, track their performance. One dashboard for your whole operation.' },
              { title: 'Built-in analytics', desc: 'See revenue, repeat clients, top services, and earnings in one place. Export for your accountant.' },
            ].map(({ title, desc }) => (
              <div key={title} className={styles.card}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>{title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: 'var(--space-3xl) 0' }}>
          <Link to="/signup">
            <Button size="lg">Get started — it's free <ArrowRight size={18} /></Button>
          </Link>
        </div>
      </div>
    </>
  )
}
