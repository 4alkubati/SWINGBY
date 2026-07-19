import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import styles from './ComingSoon.module.css'
import HeroLottie from '../components/HeroLottie'
import Testimonials from '../components/Testimonials'
import Footer from '../components/Footer'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const HOW_IT_WORKS = {
  client: {
    post: [
      {
        num: '01',
        title: 'Post your job',
        desc: 'Describe what you need, set your budget, and pick a category. Takes 60 seconds.',
      },
      {
        num: '02',
        title: 'Review quotes',
        desc: 'Nearby businesses express interest with their price. You compare and choose who you trust.',
      },
      {
        num: '03',
        title: 'Get it done',
        desc: 'Chat in-app from the quote onward, confirm the booking, and pay securely through SwingBy.',
      },
    ],
    browse: [
      {
        num: '01',
        title: 'Search nearby',
        desc: 'Open the map and instantly see verified service providers in your area.',
      },
      {
        num: '02',
        title: 'Check their profile',
        desc: 'Read reviews, see past work, and compare ratings before you commit to anyone.',
      },
      {
        num: '03',
        title: 'Book directly',
        desc: 'Request a booking straight from their profile. No phone tag, no back-and-forth.',
      },
    ],
  },
  business: {
    respond: [
      {
        num: '01',
        title: 'Browse open jobs',
        desc: 'See live client requests near you, filtered by your service category.',
      },
      {
        num: '02',
        title: 'Send your quote',
        desc: 'Express interest with your price. The client reviews and picks the best fit.',
      },
      {
        num: '03',
        title: 'Win & get paid',
        desc: 'Client confirms, you do the work, payment is released securely to your account.',
      },
    ],
    discover: [
      {
        num: '01',
        title: 'Build your profile',
        desc: 'List your services, set your radius, add photos, and get verified on the platform.',
      },
      {
        num: '02',
        title: 'Appear on the map',
        desc: 'Clients searching nearby will find your business and reach out directly.',
      },
      {
        num: '03',
        title: 'Grow your business',
        desc: 'Collect reviews after every job and build a reputation that wins you more clients.',
      },
    ],
  },
}

const FAQ_ITEMS = [
  {
    question: 'How does SwingBy work?',
    answer:
      'SwingBy connects you with local service businesses in minutes. Post a job describing what you need — plumbing fix, house cleaning, lawn care, etc. — and set your preferred date. Nearby businesses will send you quotes. You review them side-by-side and accept the best one. Payment is handled securely through the app: half is released to the business when you accept the quote so they can schedule the work, and the rest when the job is marked complete.',
  },
  {
    question: 'How do quotes get accepted?',
    answer:
      'After posting a job, you\'ll receive quotes from interested businesses in the Quotes tab. Each quote shows the business name, star rating, jobs completed, and their price. Tap "Select" on the one you want. A booking is created instantly, and both you and the business receive a confirmation. You can message a business on its quote thread before you accept, and that same conversation carries over into the booking.',
  },
  {
    question: 'When does payment happen?',
    answer:
      'When you accept a quote, SwingBy records the payment for the job and releases 50% to the business so they can schedule and start the work. The remaining 50%, minus our 10% platform fee, is released when the job is marked complete. If something goes wrong, you can report a problem and our team will review the case.',
  },
  {
    question: 'What if a job goes wrong?',
    answer:
      'If there\'s an issue with a job, tap "Report a problem" on the booking screen. Our support team will review the case, including messages and photos submitted by both parties. Any portion of the payment not yet released can be held during the investigation. We aim to resolve disputes within 48 hours. You can also reach us directly at 4alkubati@gmail.com.',
  },
  {
    question: 'How do I become a business on SwingBy?',
    answer:
      'Sign up and select "I offer services" on the onboarding screen. You\'ll be asked for your business name, category, and service area. Once your profile is set up, you can start responding to job posts from clients in your area. For verified status (the green badge), submit your business license — our team reviews it manually within 1–2 business days.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'Go to Settings → Delete my account. You\'ll be asked to confirm. Your account and all personal data will be permanently deleted within 30 days, except where retention is required by law. If you have an active booking, please complete or cancel it before deleting. Need help? Contact us at 4alkubati@gmail.com.',
  },
]

export default function ComingSoon() {
  const [form, setForm]       = useState({ name: '', email: '', role: '', city: '', message: '' })
  const [status, setStatus]   = useState('idle') // idle | loading | success | error
  const [errMsg, setErrMsg]   = useState('')
  const [view, setView]       = useState('client')   // 'client' | 'business'
  const [flow, setFlow]       = useState('post')     // client: 'post'|'browse' — business: 'respond'|'discover'

  function switchView(v) {
    setView(v)
    setFlow(v === 'client' ? 'post' : 'respond')
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    setStatus('loading')
    setErrMsg('')
    try {
      await axios.post(`${API}/waitlist/`, {
        name:    form.name.trim(),
        email:   form.email.trim(),
        role:    form.role || 'Unknown',
        city:    form.city.trim() || undefined,
        message: form.message.trim() || undefined,
      })
      setStatus('success')
    } catch (err) {
      setErrMsg(err?.response?.data?.detail || 'Something went wrong. Try again.')
      setStatus('error')
    }
  }

  return (
    <div className={styles.page}>

      {/* ── Animated gradient background ── */}
      <div className={styles.gradientBg} aria-hidden="true" />

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <span className={styles.logo}>SwingBy</span>
        <div className={styles.navRight}>
          <span className={styles.navBadge}>Calgary, AB</span>
          <Link to="/login" className={styles.navLoginBtn}>Log in</Link>
          <Link to="/signup" className={styles.navSignupBtn}>Sign up</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero} id="main-content">
        <HeroLottie />

        <div className={styles.eyebrow}>
          <span className={styles.dot} />
          Coming Soon
        </div>

        <h1 className={styles.headline}>
          Services, on your<br />
          <span className={styles.accent}>schedule.</span>
        </h1>

        <p className={styles.sub}>
          SwingBy connects you with trusted local service providers — or helps your business
          find clients. No middlemen. No hassle. Just results.
        </p>

        {/* ── Dual CTA ── */}
        <div className={styles.heroCtas}>
          <a href="#waitlist" className={styles.ctaPrimary}>Join the waitlist</a>
          <Link to="/login" className={styles.ctaSecondary}>Log in</Link>
        </div>

        {/* ── Role pills ── */}
        <div className={styles.pills}>
          <div className={styles.pill}>
            <span className={styles.pillIcon}>🔍</span>
            <div>
              <div className={styles.pillTitle}>Looking for a service?</div>
              <div className={styles.pillSub}>Post your job, get matched instantly</div>
            </div>
          </div>
          <div className={styles.pillDivider} />
          <div className={styles.pill}>
            <span className={styles.pillIcon}>💼</span>
            <div>
              <div className={styles.pillTitle}>Running a business?</div>
              <div className={styles.pillSub}>Get discovered, win more clients</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Waitlist Form ── */}
      <section className={styles.formSection} id="waitlist">
        <div className={styles.formCard}>
          {status === 'success' ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>✓</div>
              <h3>You're on the list.</h3>
              <p>We'll reach out as soon as SwingBy launches in your area.</p>
            </div>
          ) : (
            <>
              <div className={styles.formHeader}>
                <h2>Get early access</h2>
                <p>Be first when we launch. No spam — ever.</p>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Full name</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>I am a...</label>
                    <select name="role" value={form.role} onChange={handleChange}>
                      <option value="">Select role</option>
                      <option value="Client">Client — looking for services</option>
                      <option value="Business">Business — offering services</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>City <span className={styles.optional}>(optional)</span></label>
                    <input
                      type="text"
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      placeholder="e.g. Calgary, AB"
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Message <span className={styles.optional}>(optional)</span></label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="What service are you looking for, or what does your business offer?"
                    rows={3}
                  />
                </div>

                {status === 'error' && (
                  <div className={styles.errorMsg}>{errMsg}</div>
                )}

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Joining...' : 'Join the waitlist →'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className={styles.howSection}>
        <h2 className={styles.sectionTitle}>How SwingBy works</h2>

        <div className={styles.toggleWrap}>
          {/* Level 1 — role toggle */}
          <div className={styles.toggle} role="group" aria-label="View type">
            <button
              className={`${styles.toggleBtn} ${view === 'client' ? styles.toggleActive : ''}`}
              onClick={() => switchView('client')}
              aria-pressed={view === 'client'}
            >
              I need a service
            </button>
            <button
              className={`${styles.toggleBtn} ${view === 'business' ? styles.toggleActive : ''}`}
              onClick={() => switchView('business')}
              aria-pressed={view === 'business'}
            >
              I offer services
            </button>
          </div>

          {/* Level 2 — flow toggle (sits below, reacts to level 1) */}
          <div className={styles.flowToggle} role="group" aria-label="Flow type">
            {view === 'client' ? (
              <>
                <button
                  className={`${styles.flowBtn} ${flow === 'post' ? styles.flowActive : ''}`}
                  onClick={() => setFlow('post')}
                  aria-pressed={flow === 'post'}
                >
                  Post a job
                </button>
                <button
                  className={`${styles.flowBtn} ${flow === 'browse' ? styles.flowActive : ''}`}
                  onClick={() => setFlow('browse')}
                  aria-pressed={flow === 'browse'}
                >
                  Browse nearby
                </button>
              </>
            ) : (
              <>
                <button
                  className={`${styles.flowBtn} ${flow === 'respond' ? styles.flowActive : ''}`}
                  onClick={() => setFlow('respond')}
                  aria-pressed={flow === 'respond'}
                >
                  Respond to posts
                </button>
                <button
                  className={`${styles.flowBtn} ${flow === 'discover' ? styles.flowActive : ''}`}
                  onClick={() => setFlow('discover')}
                  aria-pressed={flow === 'discover'}
                >
                  Get discovered
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.steps}>
          {HOW_IT_WORKS[view][flow].map((step, i) => (
            <>
              <div className={styles.step} key={step.num}>
                <div className={styles.stepNum}>{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
              {i < 2 && <div className={styles.stepArrow} key={`arrow-${i}`}>→</div>}
            </>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <Testimonials />

      {/* ── FAQ Accordion ── */}
      <section className={styles.faqSection}>
        <h2 className={styles.sectionTitle}>Frequently asked questions</h2>
        <div className={styles.faqList}>
          {FAQ_ITEMS.map((item, i) => (
            <details className={styles.faqItem} key={i}>
              <summary className={styles.faqQuestion}>
                <span>{item.question}</span>
                <span className={styles.faqChevron} aria-hidden="true" />
              </summary>
              <div className={styles.faqAnswer}>
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer />

    </div>
  )
}
