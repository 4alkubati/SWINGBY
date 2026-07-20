import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
import AppMockupFrame from '../components/AppMockupFrame'
import FindJobVisual from '../components/FindJobVisual'
import PaymentFlowVisual from '../components/PaymentFlowVisual'
import styles from './HowItWorks.module.css'

const STEPS = [
  {
    n: 1,
    title: 'Sign up + verify',
    desc: 'Create your business account in two minutes. Add your trade, service area, and a couple of photos of past work. Verification is manual right now — a real human at SwingBy checks your license or trade credentials before your profile goes live.',
    mockupLabel: 'Business signup screen',
    callout: <><strong>Honest beta note:</strong> license status starts as <em>pending</em>. Manual verification in Calgary takes 24–48 hours. Automated verification is on the post-beta roadmap, not today.</>,
  },
  {
    n: 2,
    title: 'Set your service area + categories',
    desc: 'Pick a radius from your shop or home base — we use it to surface only nearby posts. Add the categories you actually do. No "we do everything" pages — clients trust focus.',
    mockupLabel: 'Service area + radius',
    mockupSrc: '/app-screens/business-setup.png',
    callout: <><strong>How we match:</strong> Haversine distance from your base to the job address. Increase the radius if you\'re slow; tighten it if you\'re drowning.</>,
  },
  {
    n: 3,
    title: 'Browse Calgary jobs nearby',
    desc: 'Open the feed. Real jobs, sorted by distance and how recently they were posted. Filters: category, budget range, timing. No mystery shopper accounts, no fake leads.',
    mockupLabel: 'Nearby jobs feed',
    mockupSrc: '/app-screens/job-management.png',
  },
  {
    n: 4,
    title: 'Quote + win the job',
    desc: 'Tap a post, add your quote and a short pitch. The client sees who you are, your rating, your sample work. If they accept, the booking is created and the first 50% releases to you immediately.',
    mockupLabel: 'Quote + interest screen',
    mockupSrc: '/app-screens/chat.png',
    callout: <><strong>Spam shield works both ways:</strong> you can\'t cold-contact a client — a conversation only opens once you\'ve quoted on their job, and it stays on that job thread.</>,
  },
  {
    n: 5,
    title: 'Complete + get paid',
    desc: 'Do the work. When the client confirms it\'s done, the remaining 50% releases — minus the 10% SwingBy fee. You keep 90% of the total. No subscription, no per-quote fee, no setup cost.',
    mockupLabel: 'Earnings + payout screen',
    mockupSrc: '/app-screens/earnings.png',
    callout: <><strong>If a client cancels:</strong> 25% penalty if they cancel more than 48 hours out, 50% within 48 hours. Credited to your account.</>,
  },
]

const FAQ = [
  { q: 'How much does it cost to start?', a: 'Zero. No signup fee, no monthly subscription, no fee for browsing or quoting. We only charge 10% on jobs you actually complete.' },
  { q: 'How fast do you verify?', a: 'In the Calgary beta, a SwingBy team member reviews each business manually — usually within 24–48 hours. We\'ll move to automated checks once we know what edge cases to catch.' },
  { q: 'Can I bring my own clients onto SwingBy?', a: 'Yes. Send them your profile link; they post, you quote, the booking flows through the app so escrow + reviews still work. Same 10% applies.' },
  { q: 'What payout method do you use?', a: 'Stripe Connect (sandbox during beta, live at general launch). We do not handle bank details directly — Stripe holds and disburses.' },
  { q: 'Can I pause my account if I\'m on vacation?', a: 'Yes. Toggle availability in your profile. Existing bookings stay; you just stop appearing in new feeds until you turn it back on.' },
]

export default function HowItWorksBusinesses() {
  return (
    <div className={styles.page}>
      <SEO
        title="How SwingBy works for businesses — Find local jobs, quote, get paid"
        description="See how SwingBy works for service businesses in Calgary. Browse nearby jobs, quote with no per-lead fee, get paid via escrow. 10% only on completed jobs — no subscription."
      />

      <section className={styles.hero}>
        <div className={styles.container}>
          <span className={styles.eyebrow}>For businesses</span>
          <h1 className={styles.heroTitle}>Find work in Calgary. Quote in seconds. Get paid through escrow.</h1>
          <p className={styles.heroSub}>
            No subscription, no per-lead fee. SwingBy takes 10% only when you complete a job. The other 90% is yours.
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
              <FindJobVisual />
            </div>

            <div className={styles.visualBlock}>
              <PaymentFlowVisual />
            </div>
          </div>

          <aside className={styles.rail} aria-label="Get started">
            <h3 className={styles.railTitle}>Ready to quote?</h3>
            <p className={styles.railText}>
              Two minutes to sign up. Manual verification 24–48 hours. Then you see Calgary jobs the moment they post.
            </p>
            <Link to="/signup" className={styles.railCta}>Get more jobs</Link>
            <p className={styles.railText}>
              <Link to="/how-it-works/clients" style={{ color: 'var(--color-accent-text)' }}>Looking for a service? See the client side →</Link>
            </p>
          </aside>
        </div>
      </div>

      <section className={styles.faqWrap}>
        <div className={styles.container}>
          <h2 className={styles.faqTitle}>Business FAQs</h2>
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
