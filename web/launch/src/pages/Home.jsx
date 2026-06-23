import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight, Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox, Truck,
  ShieldCheck, CurrencyDollar, Star, MapPin, MapTrifold, Headset,
} from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import AppMockupFrame from '../components/AppMockupFrame'
import styles from './Home.module.css'

const CATEGORIES = [
  { slug: 'cleaning', name: 'Cleaning', Icon: Broom },
  { slug: 'plumbing', name: 'Plumbing', Icon: Wrench },
  { slug: 'electrical', name: 'Electrical', Icon: Lightning },
  { slug: 'landscaping', name: 'Landscaping', Icon: Plant },
  { slug: 'painting', name: 'Painting', Icon: PaintBrush },
  { slug: 'carpentry', name: 'Carpentry', Icon: Hammer },
  { slug: 'handyman', name: 'Handyman', Icon: Toolbox },
  { slug: 'moving', name: 'Moving', Icon: Truck },
]

const CLIENT_STEPS = [
  { num: '01', title: 'Post a job', desc: 'Category, address, budget, photos. Two minutes.' },
  { num: '02', title: 'Get quotes', desc: 'Verified Calgary businesses tap "Express interest" with a price.' },
  { num: '03', title: 'Book + pay safely', desc: 'Pay through escrow. First 50% releases on confirmation.' },
  { num: '04', title: 'Done → release + review', desc: 'Confirm complete. Remaining 50% releases (minus 10% SwingBy fee). Leave a review.' },
]

const BUSINESS_STEPS = [
  { num: '01', title: 'Sign up + verify', desc: 'Manual verification in 24–48 hours during the Calgary beta.' },
  { num: '02', title: 'Browse nearby', desc: 'Real jobs sorted by distance and recency. No mystery leads.' },
  { num: '03', title: 'Quote + win', desc: 'Tap a post, add your price and pitch. Booking unlocks chat + address.' },
  { num: '04', title: 'Complete + paid', desc: 'You keep 90% after the 10% commission. No subscription, no per-quote fee.' },
]

const TRUST = [
  { Icon: ShieldCheck, title: 'Verified businesses', desc: 'Manual license + identity check before any business can quote.' },
  { Icon: CurrencyDollar, title: 'Escrow protection', desc: 'Your money sits with SwingBy until the job is confirmed done.' },
  { Icon: MapTrifold, title: 'Canadian-owned', desc: 'Built in Calgary. Data in Canadian regions. Real local support.' },
  { Icon: Headset, title: 'Real human support', desc: '72-hour dispute review. We can withhold payment until resolved.' },
  { Icon: Star, title: 'Honest reviews', desc: 'Only confirmed bookings can leave one. Businesses can\'t suppress them.' },
]

const FAQ = [
  { q: 'Is SwingBy free for clients?', a: 'Yes. Posting jobs and receiving quotes is free. You pay the agreed price to the business — nothing more. The 10% commission comes out of the business\'s payout, not on top of your bill.' },
  { q: 'How are businesses verified?', a: 'A SwingBy team member reviews each license and identity manually during the Calgary beta. Automated checks come post-beta once we know the edge cases to catch.' },
  { q: 'How does payment work?', a: 'Payment is held in escrow when you book. 50% is released on booking confirmation. The remaining 50% releases when you confirm the job is done — minus our 10% fee.' },
  { q: 'What if I\'m not happy with the work?', a: 'Open a dispute through the app. SwingBy support reviews within 72 hours and can withhold payment until it\'s resolved.' },
  { q: 'Which cities are supported?', a: 'Live in Calgary today. Other cities will open once we have enough verified businesses to quote there — no fake city pages.' },
]

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

export default function Home() {
  const { t } = useTranslation()
  return (
    <>
      <SEO
        description="Post a job, get quotes from verified Calgary businesses, book with escrow-protected payments. No subscription for businesses — 10% only when paid."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'SwingBy',
          url: 'https://swingbyy.com',
          description: 'Local services marketplace connecting clients with verified businesses in Calgary.',
        }}
      />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <motion.div className={styles.heroContent} {...fadeUp}>
            <div className={styles.heroBadge}><MapPin size={14} weight="fill" /> Now live in Calgary</div>
            <h1 className={styles.heroTitle}>{t('home.hero.headline')}</h1>
            <p className={styles.heroSubtitle}>{t('home.hero.sub')}</p>
            <div className={styles.heroCtas}>
              <Link to="/signup"><Button size="lg">Post a job — it&apos;s free</Button></Link>
              <Link to="/signup?role=business">
                <Button variant="secondary" size="lg">
                  Get more jobs <ArrowRight size={18} />
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

      {/* Trust strip */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <h2 className={styles.sectionTitle}>Built on trust</h2>
            <p className={styles.sectionSubtitle}>Five things we hold ourselves to.</p>
          </motion.div>
          <div className={styles.trustGrid}>
            {TRUST.map(({ Icon, title, desc }, i) => (
              <motion.div key={title} className={styles.pillar} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
                <div className={styles.pillarIcon}><Icon size={28} weight="duotone" /></div>
                <h3 className={styles.pillarTitle}>{title}</h3>
                <p className={styles.pillarDesc}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — two columns */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <h2 className={styles.sectionTitle}>How SwingBy works</h2>
            <p className={styles.sectionSubtitle}>Same platform, two flows.</p>
          </motion.div>
          <div className={styles.twoCol}>
            <div className={styles.colCard}>
              <h3 className={styles.colTitle}>For clients</h3>
              <ol className={styles.colSteps}>
                {CLIENT_STEPS.map((s) => (
                  <li key={s.num}>
                    <span className={styles.colNum}>{s.num}</span>
                    <div>
                      <p className={styles.colStepTitle}>{s.title}</p>
                      <p className={styles.colStepDesc}>{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/how-it-works/clients" className={styles.colLink}>See the full client flow <ArrowRight size={14} weight="bold" /></Link>
            </div>

            <div className={styles.colCard}>
              <h3 className={styles.colTitle}>For businesses</h3>
              <ol className={styles.colSteps}>
                {BUSINESS_STEPS.map((s) => (
                  <li key={s.num}>
                    <span className={styles.colNum}>{s.num}</span>
                    <div>
                      <p className={styles.colStepTitle}>{s.title}</p>
                      <p className={styles.colStepDesc}>{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/how-it-works/businesses" className={styles.colLink}>See the full business flow <ArrowRight size={14} weight="bold" /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* App preview */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.appPreview}>
            <div className={styles.appPreviewCopy}>
              <h2 className={styles.sectionTitle}>The app — Calgary jobs, one tap away</h2>
              <p className={styles.sectionSubtitle}>
                Native iOS and Android. Browse nearby posts, quote without leaving the feed, message safely once a booking is confirmed.
              </p>
              <p className={styles.appPreviewMeta}>
                <span className={styles.appPreviewBadge}>Coming Aug 2026</span>
                <span className={styles.appPreviewNote}>App store listings open at general launch.</span>
              </p>
            </div>
            <div className={styles.appPreviewMockup}>
              <AppMockupFrame label="Nearby jobs feed" alt="SwingBy app — nearby jobs feed mockup" width={300} />
            </div>
          </div>
        </div>
      </section>

      {/* Live in Calgary */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.cityBlock} {...fadeUp}>
            <div className={styles.cityCopy}>
              <span className={styles.eyebrow}>Live in Calgary</span>
              <h2 className={styles.cityTitle}>Built local, before going national.</h2>
              <p className={styles.cityText}>
                We&apos;re proving the model in Calgary first. Every business is checked by a real human. Every quote is from someone who can actually do the job in your neighbourhood.
              </p>
              <p className={styles.cityText}>
                <strong>Next on the map:</strong> Edmonton and Red Deer, once Calgary supply is deep enough to support a second city.
              </p>
              <Link to="/calgary" className={styles.colLink}>See Calgary coverage <ArrowRight size={14} weight="bold" /></Link>
            </div>
            <div className={styles.cityMap} aria-hidden="true">
              <svg viewBox="0 0 200 200" role="presentation">
                <circle cx="100" cy="100" r="80" fill="rgba(110,86,247,0.10)" stroke="var(--color-accent)" strokeDasharray="4 4" />
                <circle cx="100" cy="100" r="40" fill="rgba(110,86,247,0.18)" />
                <circle cx="100" cy="100" r="6" fill="var(--color-accent)" />
                <text x="100" y="130" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="11" fontFamily="Inter, sans-serif">Calgary</text>
              </svg>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stories placeholder — honest, no invented quotes */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <h2 className={styles.sectionTitle}>Real stories landing post-beta</h2>
            <p className={styles.sectionSubtitle}>
              We&apos;re holding this space for actual client and business quotes once the beta cohort completes their first bookings. Fake testimonials aren&apos;t our style.
            </p>
          </motion.div>
          <div className={styles.storiesSkeleton}>
            <div className={styles.storyCard}>
              <div className={styles.storyDot} />
              <p className={styles.storyText}>First client story drops once we&apos;ve closed five real bookings.</p>
            </div>
            <div className={styles.storyCard}>
              <div className={styles.storyDot} />
              <p className={styles.storyText}>First business story drops once one Calgary pro hits five completed jobs.</p>
            </div>
            <div className={styles.storyCard}>
              <div className={styles.storyDot} />
              <p className={styles.storyText}>Want to be one of the first names here? <Link to="/signup" className={styles.colLink}>Join the beta</Link></p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.h2 className={styles.sectionTitle} {...fadeUp}>Common questions</motion.h2>
          <div className={styles.faqList}>
            {FAQ.map(({ q, a }, i) => (
              <motion.details key={q} className={styles.faqItem} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.05 }}>
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
              <Link to="/how-it-works/clients">
                <Button variant="ghost" size="lg">See how it works</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
