import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight, Broom, Wrench, Lightning, Plant, PaintBrush, Hammer, Toolbox, Truck,
  ShieldCheck, ChatCircleText, MapPin, Leaf, Star,
} from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import AppMockupFrame from '../components/AppMockupFrame'
import styles from './Home.module.css'

const CATEGORIES = [
  { slug: 'cleaning',    key: 'cleaning',    Icon: Broom },
  { slug: 'plumbing',    key: 'plumbing',    Icon: Wrench },
  { slug: 'electrical',  key: 'electrical',  Icon: Lightning },
  { slug: 'landscaping', key: 'landscaping', Icon: Plant },
  { slug: 'painting',    key: 'painting',    Icon: PaintBrush },
  { slug: 'carpentry',   key: 'carpentry',   Icon: Hammer },
  { slug: 'handyman',    key: 'handyman',    Icon: Toolbox },
  { slug: 'moving',      key: 'moving',      Icon: Truck },
]

const SHOWCASE_SCREENS = [
  { key: 'postJob', img: 'post-job' },
  { key: 'quotes',  img: 'quotes' },
  { key: 'chat',    img: 'chat' },
  { key: 'booking', img: 'booking' },
  { key: 'receipt', img: 'receipt' },
]

const CLIENT_STEP_KEYS = ['1', '2', '3', '4']
const BUSINESS_STEP_KEYS = ['1', '2', '3', '4']
const TRUST_KEYS = ['verified', 'reviews', 'canadian', 'support']
const FAQ_KEYS = ['free', 'verify', 'payment', 'unhappy', 'cities']

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

      {/* ─────────────── Hero ─────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <motion.div className={styles.heroContent} {...fadeUp}>
            <div className={styles.livePill}>
              <span className={styles.liveDot} aria-hidden="true" />
              {t('home.hero.livePill')}
            </div>
            <h1 className={styles.heroTitle}>
              {t('home.hero.headlineLead')}{' '}
              <span className={styles.accent}>{t('home.hero.headlineAccent')}</span>
            </h1>
            <p className={styles.heroSub}>{t('home.hero.sub')}</p>

            <div className={styles.heroCtas}>
              <Link to="/signup"><Button size="lg">{t('home.hero.ctaPrimary')}</Button></Link>
              <Link to="/signup?role=business">
                <Button variant="secondary" size="lg">
                  {t('home.hero.ctaSecondary')} <ArrowRight size={18} weight="regular" />
                </Button>
              </Link>
            </div>

            <ul className={styles.heroTrust}>
              <li><ShieldCheck size={16} weight="regular" className={styles.trustGreen} /> {t('home.hero.trust.verified')}</li>
              <li><Leaf size={16} weight="regular" className={styles.trustGreen} /> {t('home.hero.trust.escrow')}</li>
              <li><MapPin size={16} weight="regular" className={styles.trustGreen} /> {t('home.hero.trust.local')}</li>
            </ul>
          </motion.div>

          <motion.div className={styles.heroMap} {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
            <div className={styles.mapGrid} aria-hidden="true" />
            <svg className={styles.mapRoute} viewBox="0 0 520 520" aria-hidden="true">
              <path
                d="M 80 400 C 160 340, 200 260, 260 220 S 400 160, 440 100"
                fill="none"
                stroke="#8878F9"
                strokeWidth="2"
                strokeDasharray="8 8"
                strokeLinecap="round"
              />
            </svg>

            <span className={styles.mapPin} style={{ top: '75%', left: '15%' }} aria-hidden="true">
              <span className={styles.mapPinInner} />
              <span className={styles.mapPinRing} />
            </span>
            <span className={styles.mapPinDest} style={{ top: '18%', left: '82%' }} aria-hidden="true">
              <span className={styles.mapPinDestInner} />
            </span>

            {/* Floating quote card */}
            <div className={styles.floatCardQuote}>
              <div className={styles.floatCardRow}>
                <div className={styles.floatAvatar} aria-hidden="true" />
                <div className={styles.floatCardMeta}>
                  <p className={styles.floatCardName}>Bow River Cleaning</p>
                  <p className={styles.floatCardRating}>
                    <Star size={12} weight="fill" className={styles.starIcon} /> 4.9 · 128 reviews
                  </p>
                </div>
                <p className={styles.floatCardPrice}>$180</p>
              </div>
              <p className={styles.floatCardSub}>{t('home.hero.floatQuoteSub')}</p>
            </div>

            {/* Floating tracking card */}
            <div className={styles.floatCardTrack}>
              <p className={styles.trackEyebrow}>
                <span className={styles.liveDot} aria-hidden="true" />
                {t('home.hero.floatTrackEyebrow')}
              </p>
              <p className={styles.trackTitle}>{t('home.hero.floatTrackTitle')}</p>
              <p className={styles.trackSub}>{t('home.hero.floatTrackSub')}</p>
            </div>

            <div className={styles.mapInfoBar}>
              <p><strong>142 {t('home.hero.mapInfoStat')}</strong> {t('home.hero.mapInfoCity')}</p>
              <Link to="/calgary" className={styles.mapInfoLink}>{t('home.hero.mapInfoLink')} <ArrowRight size={13} weight="regular" /></Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────── Category grid ─────────────── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <span className={styles.eyebrow}>{t('home.categories.eyebrow')}</span>
            <h2 className={styles.sectionTitle}>{t('home.categories.title')}</h2>
          </motion.div>
          <div className={styles.categoryGrid}>
            {CATEGORIES.map(({ slug, key, Icon }, i) => (
              <motion.div
                key={slug}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.04 }}
              >
                <Link to={`/categories/${slug}`} className={styles.categoryCard}>
                  <span className={styles.categoryIcon}><Icon size={26} weight="regular" /></span>
                  <span className={styles.categoryName}>{t(`home.categories.items.${key}`)}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── How it works ─────────────── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <span className={styles.eyebrow}>{t('home.howItWorks.eyebrow')}</span>
            <h2 className={styles.sectionTitle}>{t('home.howItWorks.title')}</h2>
          </motion.div>

          <div className={styles.twoCol}>
            <motion.div className={styles.flowCard} {...fadeUp}>
              <div className={styles.flowHeader}>
                <span className={styles.flowTag}>{t('home.howItWorks.forClients')}</span>
                <h3 className={styles.flowTitle}>{t('home.howItWorks.clientTitle')}</h3>
              </div>
              <ol className={styles.flowSteps}>
                {CLIENT_STEP_KEYS.map((k) => (
                  <li key={k} className={styles.flowStep}>
                    <span className={styles.flowNum}>0{k}</span>
                    <div>
                      <p className={styles.flowStepTitle}>{t(`home.howItWorks.client.${k}.title`)}</p>
                      <p className={styles.flowStepDesc}>{t(`home.howItWorks.client.${k}.desc`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/how-it-works/clients" className={styles.flowLink}>
                {t('home.howItWorks.clientLink')} <ArrowRight size={14} weight="regular" />
              </Link>
            </motion.div>

            <motion.div className={`${styles.flowCard} ${styles.flowCardBiz}`} {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
              <div className={styles.flowHeader}>
                <span className={styles.flowTag}>{t('home.howItWorks.forBusinesses')}</span>
                <h3 className={styles.flowTitle}>{t('home.howItWorks.businessTitle')}</h3>
              </div>
              <ol className={styles.flowSteps}>
                {BUSINESS_STEP_KEYS.map((k) => (
                  <li key={k} className={styles.flowStep}>
                    <span className={styles.flowNum}>0{k}</span>
                    <div>
                      <p className={styles.flowStepTitle}>{t(`home.howItWorks.business.${k}.title`)}</p>
                      <p className={styles.flowStepDesc}>{t(`home.howItWorks.business.${k}.desc`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/how-it-works/businesses" className={styles.flowLink}>
                {t('home.howItWorks.businessLink')} <ArrowRight size={14} weight="regular" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─────────────── App screens showcase ─────────────── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <span className={styles.eyebrow}>{t('home.showcase.eyebrow')}</span>
            <h2 className={styles.sectionTitle}>{t('home.showcase.title')}</h2>
          </motion.div>
          <div className={styles.showcaseRow}>
            {SHOWCASE_SCREENS.map(({ key, img }, i) => (
              <motion.div
                key={key}
                className={styles.showcaseItem}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.05 }}
              >
                <AppMockupFrame
                  src={`/app-screens/${img}.png`}
                  alt={`SwingBy app — ${t(`home.showcase.items.${key}.title`)}`}
                  width={210}
                />
                <div className={styles.showcaseCaption}>
                  <p className={styles.showcaseTitle}>{t(`home.showcase.items.${key}.title`)}</p>
                  <p className={styles.showcaseDesc}>{t(`home.showcase.items.${key}.desc`)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── Escrow band ─────────────── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.escrowBand} {...fadeUp}>
            <div className={styles.escrowGlow} aria-hidden="true" />
            <div className={styles.escrowCopy}>
              <span className={styles.eyebrowSoft}>{t('home.escrow.eyebrow')}</span>
              <h2 className={styles.escrowTitle}>{t('home.escrow.title')}</h2>
              <p className={styles.escrowBody}>{t('home.escrow.body')}</p>
            </div>

            <div className={styles.ledger}>
              <p className={styles.ledgerTitle}>{t('home.escrow.ledgerTitle')}</p>
              <ul className={styles.ledgerList}>
                <li>
                  <div>
                    <p className={styles.ledgerRowTitle}>{t('home.escrow.row1Title')}</p>
                    <p className={styles.ledgerRowSub}>{t('home.escrow.row1Sub')}</p>
                  </div>
                  <span className={styles.ledgerAmount}>$180</span>
                </li>
                <li>
                  <div>
                    <p className={styles.ledgerRowTitle}>{t('home.escrow.row2Title')}</p>
                    <p className={styles.ledgerRowSub}>{t('home.escrow.row2Sub')}</p>
                  </div>
                  <span className={`${styles.ledgerAmount} ${styles.money}`}>+$90</span>
                </li>
                <li>
                  <div>
                    <p className={styles.ledgerRowTitle}>{t('home.escrow.row3Title')}</p>
                    <p className={styles.ledgerRowSub}>{t('home.escrow.row3Sub')}</p>
                  </div>
                  <span className={`${styles.ledgerAmount} ${styles.money}`}>+$90</span>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────── Trust row ─────────────── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <span className={styles.eyebrow}>{t('home.trust.eyebrow')}</span>
            <h2 className={styles.sectionTitle}>{t('home.trust.title')}</h2>
          </motion.div>
          <div className={styles.trustGrid}>
            {TRUST_KEYS.map((k, i) => {
              const iconMap = { verified: ShieldCheck, reviews: Star, canadian: Leaf, support: ChatCircleText }
              const Icon = iconMap[k]
              return (
                <motion.div key={k} className={styles.trustCard} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
                  <div className={styles.trustIcon}><Icon size={24} weight="regular" /></div>
                  <h3 className={styles.trustTitle}>{t(`home.trust.items.${k}.title`)}</h3>
                  <p className={styles.trustDesc}>{t(`home.trust.items.${k}.desc`)}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─────────────── Live in Calgary — radar ─────────────── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.cityBlock} {...fadeUp}>
            <div className={styles.cityCopy}>
              <span className={styles.eyebrow}>{t('home.calgary.eyebrow')}</span>
              <h2 className={styles.cityTitle}>{t('home.calgary.title')}</h2>
              <p className={styles.cityText}>{t('home.calgary.body')}</p>
              <div className={styles.cityNext}>
                <p className={styles.cityNextLabel}>{t('home.calgary.nextLabel')}</p>
                <div className={styles.cityChips}>
                  <span className={styles.cityChip}>Edmonton</span>
                  <span className={styles.cityChip}>Red Deer</span>
                </div>
              </div>
            </div>

            <div className={styles.radarWrap} aria-hidden="true">
              <div className={styles.radar}>
                <span className={`${styles.radarRing} ${styles.ring1}`} />
                <span className={`${styles.radarRing} ${styles.ring2}`} />
                <span className={`${styles.radarRing} ${styles.ring3}`} />
                <span className={styles.radarDashed} />
                <span className={styles.radarCenter}>
                  <span className={styles.radarCore} />
                </span>
                <span className={styles.radarLabel}>Calgary</span>
                <span className={styles.radarNextPill}>
                  <span className={styles.liveDotAccent} /> Edmonton · next
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────── App section ─────────────── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.appBand} {...fadeUp}>
            <div className={styles.appCopy}>
              <span className={styles.eyebrow}>{t('home.app.eyebrow')}</span>
              <h2 className={styles.appTitle}>{t('home.app.title')}</h2>
              <p className={styles.appBody}>{t('home.app.body')}</p>
              <div className={styles.appMeta}>
                <span className={styles.appBadge}>
                  <span className={styles.liveDotAccent} />
                  {t('home.app.comingBadge')}
                </span>
                <span className={styles.appNote}>{t('home.app.storeNote')}</span>
              </div>
            </div>
            <div className={styles.appMockup}>
              <AppMockupFrame src="/app-screens/nearby-map.png" alt="SwingBy app — browse verified pros nearby on the map" width={260} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────── FAQ ─────────────── */}
      <section className={styles.section}>
        <div className={styles.container}>
          <motion.div className={styles.sectionHeader} {...fadeUp}>
            <span className={styles.eyebrow}>{t('home.faq.eyebrow')}</span>
            <h2 className={styles.sectionTitle}>{t('home.faq.title')}</h2>
          </motion.div>
          <div className={styles.faqList}>
            {FAQ_KEYS.map((k, i) => (
              <motion.details key={k} className={styles.faqItem} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.04 }}>
                <summary className={styles.faqQ}>{t(`home.faq.items.${k}.q`)}</summary>
                <p className={styles.faqA}>{t(`home.faq.items.${k}.a`)}</p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── Final CTA ─────────────── */}
      <section className={styles.finalCta}>
        <div className={styles.finalGlow} aria-hidden="true" />
        <div className={styles.container}>
          <motion.div className={styles.finalInner} {...fadeUp}>
            <h2 className={styles.finalTitle}>{t('home.finalCta.title')}</h2>
            <p className={styles.finalSub}>{t('home.finalCta.sub')}</p>
            <div className={styles.finalCtas}>
              <Link to="/signup"><Button size="lg">{t('home.finalCta.primary')}</Button></Link>
              <Link to="/how-it-works/clients">
                <Button variant="secondary" size="lg">
                  {t('home.finalCta.secondary')} <ArrowRight size={18} weight="regular" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
