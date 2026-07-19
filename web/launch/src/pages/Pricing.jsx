import { Link } from 'react-router-dom'
import { Check, Sparkle } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import Badge from '../components/Badge'
import styles from './page.module.css'

const ADDONS = [
  { name: 'Featured listing', price: '$29/month', desc: 'Top placement in your category and neighbourhood. Max 3 featured slots per area.' },
  { name: 'Boost (per-use)', price: '$5 / 24h', desc: 'Same placement bump — single-shot, no subscription.' },
  { name: 'Verified Business badge', price: '$99/year', desc: 'Manual license, insurance, and reference verification. Filter target.' },
  { name: 'Lead pack — Starter', price: '$50', desc: '10 lead intros, no 10% fee on those bookings.' },
  { name: 'Lead pack — Growth', price: '$200', desc: '50 lead intros, no 10% fee on those bookings.' },
]

const CANCELLATION = [
  { trigger: 'Client cancels >48h before', penalty: 'None', who: '—' },
  { trigger: 'Client cancels ≤48h before', penalty: '25% of total', who: 'Client pays' },
  { trigger: 'Client no-show', penalty: '50% of total', who: 'Client pays' },
  { trigger: 'Business cancels >48h before', penalty: 'None', who: '—' },
  { trigger: 'Business cancels ≤48h before', penalty: '25% of total', who: 'Business pays' },
  { trigger: 'Business no-show', penalty: '50% + warning', who: 'Business pays' },
]

export default function Pricing() {
  return (
    <>
      <SEO title="Pricing" description="SwingBy is free for clients. Businesses pay 10% on completion — nothing else to start. See founder pricing for early adopters." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Simple, transparent pricing</h1>
          <p className={styles.pageSubtitle}>Free for clients. Businesses pay a flat 10% only when a job is completed.</p>
        </div>

        {/* Founder pricing banner */}
        <div style={{ background: 'rgba(110,86,247,0.12)', border: '1px solid rgba(110,86,247,0.3)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', marginBottom: 'var(--space-3xl)', display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(136,120,249,0.15)', color: 'var(--color-accent-soft)', flexShrink: 0 }}>
            <Sparkle size={22} weight="regular" />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>Founder pricing — first 100 businesses</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
              <strong style={{ color: 'var(--color-accent-text)' }}>5% transaction fee</strong> (instead of 10%) locked for 6 months from your first completed booking.
              Plus: Verified badge free for year 1, first featured month free.
              Spots are filling — join early.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              "First 100" = first 100 businesses with at least one completed booking, not 100 signups.
            </p>
          </div>
          <Link to="/signup" style={{ flexShrink: 0 }}><Button>Join now</Button></Link>
        </div>

        {/* Tiers */}
        <div className={styles.grid2} style={{ marginBottom: 'var(--space-3xl)' }}>
          <div className={styles.card}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '24px', color: 'var(--color-text-primary)' }}>For clients</h2>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '48px', color: 'var(--color-accent-text)', lineHeight: 1 }}>Free</div>
              <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>Forever. No hidden fees.</p>
            </div>
            {['Post unlimited jobs', 'Receive competitive quotes', 'Compare businesses and reviews', 'Split escrow payments', 'In-app messaging from quote through booking', 'Dispute protection'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Check size={16} weight="bold" color="var(--color-success)" />
                <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{f}</span>
              </div>
            ))}
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <Link to="/signup"><Button style={{ width: '100%' }}>Post a job free</Button></Link>
            </div>
          </div>

          <div className={styles.card} style={{ borderColor: 'var(--color-accent)', position: 'relative' }}>
            <Badge variant="accent" style={{ position: 'absolute', top: '-10px', right: '20px' }}>Most popular</Badge>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '24px', color: 'var(--color-text-primary)' }}>For businesses</h2>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '48px', color: 'var(--color-accent-text)', lineHeight: 1 }}>10%</div>
              <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>Per completed booking — that's it.</p>
            </div>
            {['Free signup and listing', 'Free geo-browse visibility', 'Unlimited interest expressions', 'Free messaging on every job you quote on', '50% payout on booking confirmation, balance on completion', '10% platform fee deducted automatically'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Check size={16} weight="bold" color="var(--color-success)" />
                <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{f}</span>
              </div>
            ))}
            <div style={{ marginTop: 'var(--space-lg)' }}>
              <Link to="/signup"><Button style={{ width: '100%' }}>List your business</Button></Link>
            </div>
          </div>
        </div>

        {/* Add-ons */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Optional add-ons (coming month 2)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {ADDONS.map(a => (
              <div key={a.name} className={styles.card} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '15px' }}>{a.name}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{a.desc}</p>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-accent-text)', fontSize: '16px', flexShrink: 0 }}>{a.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cancellation */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Cancellation & dispute fees</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  {['Trigger', 'Penalty', 'Who pays'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CANCELLATION.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-primary)' }}>{row.trigger}</td>
                    <td style={{ padding: '12px 16px', color: row.penalty === 'None' ? 'var(--color-success)' : 'var(--color-warning)' }}>{row.penalty}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{row.who}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
