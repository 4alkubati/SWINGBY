import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox,
  ShieldCheck, CurrencyDollar, Star, MapPin,
} from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import styles from './Home.module.css'

const CATEGORIES = [
  { slug: 'cleaning', name: 'Cleaning', Icon: Broom },
  { slug: 'plumbing', name: 'Plumbing', Icon: Wrench },
  { slug: 'electrical', name: 'Electrical', Icon: Lightning },
  { slug: 'landscaping', name: 'Landscaping', Icon: Plant },
  { slug: 'painting', name: 'Painting', Icon: PaintBrush },
  { slug: 'carpentry', name: 'Carpentry', Icon: Hammer },
  { slug: 'handyman', name: 'Handyman', Icon: Toolbox },
]

const STEPS = [
  { num: '01', title: 'Post a job', desc: 'Describe what you need, set a budget, and pick your area. Takes under two minutes.' },
  { num: '02', title: 'Get quotes', desc: 'Verified local businesses send you competitive quotes. Compare ratings, reviews, and prices.' },
  { num: '03', title: 'Book with confidence', desc: 'Accept the best quote. Payment is held in escrow and released on completion.' },
]

const PILLARS = [
  { Icon: ShieldCheck, title: 'Vetted businesses', desc: 'Every business is verified before listing. License checks, reviews, ongoing monitoring.' },
  { Icon: CurrencyDollar, title: 'Safe escrow payments', desc: '50% released on booking confirmation, 50% on completion. Dispute protection built in.' },
  { Icon: Star, title: 'Real reviews', desc: 'Reviews only from confirmed clients. No fake ratings. Businesses can\'t suppress feedback.' },
]

const TESTIMONIALS = [
  { name: 'Sarah M.', role: 'Homeowner, Calgary', text: 'Found an amazing cleaner in under an hour. The quoting process made it easy to compare.' },
  { name: 'James K.', role: 'Business owner', text: 'SwingBy helped me double my bookings in the first month. The platform just works.' },
  { name: 'Priya R.', role: 'Renter, Calgary NW', text: 'No more calling around for plumbers. Posted a job, got three quotes, booked by lunch.' },
]

const FAQ = [
  { q: 'Is SwingBy free for clients?', a: 'Yes. Posting jobs and receiving quotes is free. You pay the agreed price to the business — nothing more.' },
  { q: 'How are businesses verified?', a: 'Every business goes through license checks, identity verification, and review monitoring before they can quote on jobs.' },
  { q: 'How does payment work?', a: 'Payment is held in escrow when you book. 50% is released on booking confirmation and the remaining 50% when the job is marked complete.' },
  { q: 'What if I\'m not happy with the work?', a: 'Open a dispute through the app. SwingBy support reviews it within 72 hours and can withhold payment until it\'s resolved.' },
  { q: 'Which cities are supported?', a: 'We\'re live in Calgary and expanding across Alberta in 2025.' },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

export default function Home() {
  return (
    <>
      <SEO
        description="Post a job, get quotes from verified local businesses, and book with confidence. Escrow payments, real reviews, Calgary-based."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'SwingBy',
          url: 'https://swingby.ca',
          description: 'Local services marketplace connecting clients with verified businesses in Calgary.',
        }}
      />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <motion.div className={styles.heroContent} {...fadeUp}>
            <div className={styles.heroBadge}><MapPin size={14} weight="fill" /> Now live in Calgary</div>
            <h1 className={styles.heroTitle}>Local services, trusted and simple</h1>
            <p className={styles.heroSubtitle}>
              Post a job, receive quotes from vetted local businesses, and book — all in one place.
              Safe escrow payments. Real reviews. No surprises.
            </p>
            <div className={styles.heroCtas}>
              <Link to="/signup"><Button size="lg">Post a job free</Button></Link>
              <Link to="/for-businesses">
                <Button variant="secondary" size="lg">
                  Join as a business <ArrowRight size={18} />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Category strip */}
      <section className={styles.categories}>
        <div className={styles.container}>
          <div className={styles.categoryGrid}>
            {CATEGORIES.map(({ slug, name, Icon }) => (
              <Link key={slug} to={`/categories/${slug}`} className={styles.categoryCard}>
                <div className={styles.categoryIcon}><Icon size={28} weight="duotone" /></div>
                <span className={styles.categoryName}>{name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <h2 className={styles.sectionTitle}>Simple from start to finish</h2>
            <p className={styles.sectionSubtitle}>Three steps to booking a local pro.</p>
          </motion.div>
          <div className={styles.stepsGrid}>
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                className={styles.stepCard}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              >
                <span className={styles.stepNum}>{step.num}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust pillars */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <h2 className={styles.sectionTitle}>Built on trust</h2>
          </motion.div>
          <div className={styles.pillarsGrid}>
            {PILLARS.map(({ Icon, title, desc }, i) => (
              <motion.div key={i} className={styles.pillar} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                <div className={styles.pillarIcon}><Icon size={32} weight="duotone" /></div>
                <h3 className={styles.pillarTitle}>{title}</h3>
                <p className={styles.pillarDesc}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.h2 className={styles.sectionTitle} {...fadeUp}>What people say</motion.h2>
          <div className={styles.testimonialGrid}>
            {TESTIMONIALS.map((t, i) => (
              <motion.blockquote key={i} className={styles.testimonialCard} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
                <p className={styles.testimonialText}>&ldquo;{t.text}&rdquo;</p>
                <footer className={styles.testimonialAuthor}>
                  <strong>{t.name}</strong> — {t.role}
                </footer>
              </motion.blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.h2 className={styles.sectionTitle} {...fadeUp}>Common questions</motion.h2>
          <div className={styles.faqList}>
            {FAQ.map(({ q, a }, i) => (
              <motion.details key={i} className={styles.faqItem} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.05 }}>
                <summary className={styles.faqQ}>{q}</summary>
                <p className={styles.faqA}>{a}</p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <motion.div className={styles.ctaInner} {...fadeUp}>
            <h2 className={styles.ctaTitle}>Ready to book your first service?</h2>
            <p className={styles.ctaSubtitle}>Post a job in two minutes. Free for clients, always.</p>
            <div className={styles.heroCtas}>
              <Link to="/signup"><Button size="lg">Get started free</Button></Link>
              <Link to="/how-it-works">
                <Button variant="ghost" size="lg">See how it works</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
