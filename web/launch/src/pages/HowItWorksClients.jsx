import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import AppMockupFrame from '../components/AppMockupFrame'
import PaymentFlowVisual from '../components/PaymentFlowVisual'
import PostJobVisual from '../components/PostJobVisual'
import styles from './HowItWorks.module.css'

const STEPS = [
  {
    n: 1,
    title: 'Post a job',
    desc: 'Describe what you need: category, address, budget range, when you want it done, and a couple of photos if it helps. Two minutes, no account required to start.',
    mockupLabel: 'Post-a-job form',
    mockupSrc: '/app-screens/post-job.png',
    callout: <><strong>What businesses see:</strong> your post, your category, your area — never your phone number or full address until you accept a quote.</>,
  },
  {
    n: 2,
    title: 'Get matched quotes',
    desc: 'Verified Calgary businesses tap "Express interest" with a price. You see who they are, what they\'ve done, what other clients said. No pressure, no calls.',
    mockupLabel: 'Quotes feed',
    mockupSrc: '/app-screens/quotes.png',
    callout: <><strong>Spam shield:</strong> businesses can\'t contact you directly. Every quote comes through SwingBy so you control the conversation.</>,
  },
  {
    n: 3,
    title: 'Pick your pro',
    desc: 'Compare the quotes side by side: price, rating, response time, sample work. Read reviews from real bookings only — we don\'t accept anonymous ones.',
    mockupLabel: 'Compare quotes screen',
    mockupSrc: '/app-screens/nearby-map.png',
  },
  {
    n: 4,
    title: 'Book + pay safely',
    desc: 'Pay through the app. SwingBy holds the full amount in escrow. When the booking is confirmed, the business gets the first 50% — enough to cover materials and commit to the date.',
    mockupLabel: 'Booking + escrow screen',
    mockupSrc: '/app-screens/booking.png',
    callout: <><strong>Escrow protection:</strong> SwingBy never spends your money. It sits between you and the business until the job is done.</>,
  },
  {
    n: 5,
    title: 'Job done → release + review',
    desc: 'When the work is complete, you confirm in the app. The remaining 50% is released to the business minus our 10% fee. You leave a public review that future clients can see.',
    mockupLabel: 'Complete + review screen',
    mockupSrc: '/app-screens/receipt.png',
    callout: <><strong>If something goes wrong:</strong> open a dispute through the app. SwingBy support reviews within 72 hours and can withhold payment until it\'s resolved.</>,
  },
]

const FAQ = [
  { q: 'Is it really free for me?', a: 'Yes. Posting a job and receiving quotes is free. You pay the price you agreed on — nothing more. The 10% commission comes out of the business\'s payout, not on top of your bill.' },
  { q: 'What if I don\'t like any of the quotes?', a: 'Don\'t pick one. There\'s no obligation to book. Posts expire after 7 days automatically.' },
  { q: 'How fast will I get quotes?', a: 'Most posts in Calgary attract their first quote within minutes. Our target is your first quote in under 5 minutes; we\'ll publish real averages once the beta cohort is live.' },
  { q: 'What happens if the business cancels?', a: 'If they cancel more than 48 hours before the booking, they pay a 25% penalty. Within 48 hours, the penalty is 50%. The penalty is credited back to you.' },
]

export default function HowItWorksClients() {
  return (
    <div className={styles.page}>
      <SEO
        title="How SwingBy works for clients — Post a job, get quotes, book safely"
        description="See exactly how SwingBy works for clients. Post a job in two minutes, get matched quotes from verified Calgary businesses, book with escrow-protected payments."
      />

      <section className={styles.hero}>
        <div className={styles.container}>
          <span className={styles.eyebrow}>For clients</span>
          <h1 className={styles.heroTitle}>Local services, quoted in minutes</h1>
          <p className={styles.heroSub}>
            Post once. Compare verified Calgary businesses. Pay through SwingBy — half releases at booking, the rest only when the job is done.
          </p>
        </div>
      </section>

      <div className={styles.container}>
        <div className={styles.layout}>
          <div className={styles.steps}>
            {STEPS.map((step) => (
              <article className={styles.step} key={step.n}>
                <div className={styles.stepMockup}>
                  <AppMockupFrame src={step.mockupSrc} label={step.mockupLabel} alt={`${step.title} — app screen mockup`} width={300} />
                </div>
                <div className={styles.stepBody}>
                  <span className={styles.stepNumber} aria-hidden="true">{step.n}</span>
                  <h2 className={styles.stepTitle}>{step.title}</h2>
                  <p className={styles.stepDesc}>{step.desc}</p>
                  {step.callout && <div className={styles.callout}>{step.callout}</div>}
                </div>
              </article>
            ))}

            <div className={styles.visualBlock}>
              <PostJobVisual />
            </div>

            <div className={styles.visualBlock}>
              <PaymentFlowVisual />
            </div>
          </div>

          <aside className={styles.rail} aria-label="Get started">
            <h3 className={styles.railTitle}>Ready to post?</h3>
            <p className={styles.railText}>
              Two minutes to your post, around five to your first quote. No credit card to start.
            </p>
            <Link to="/signup" className={styles.railCta}>Post a job — it's free</Link>
            <p className={styles.railText}>
              <Link to="/how-it-works/businesses" style={{ color: 'var(--color-accent-text)' }}>Run a business? See how it works →</Link>
            </p>
          </aside>
        </div>
      </div>

      <section className={styles.faqWrap}>
        <div className={styles.container}>
          <h2 className={styles.faqTitle}>Client FAQs</h2>
          {FAQ.map(({ q, a }) => (
            <details key={q} className={styles.faqItem}>
              <summary className={styles.faqQ}>{q}</summary>
              <p className={styles.faqA}>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
