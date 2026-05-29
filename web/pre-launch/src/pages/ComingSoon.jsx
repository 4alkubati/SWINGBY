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
        desc: 'Confirm the booking, chat in-app, and pay securely when the job is complete.',
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

      {/* ── Background glow orbs ── */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

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
      <section className={styles.hero}>
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
          <div className={styles.toggle}>
            <button
              className={`${styles.toggleBtn} ${view === 'client' ? styles.toggleActive : ''}`}
              onClick={() => switchView('client')}
            >
              🔍 I need a service
            </button>
            <button
              className={`${styles.toggleBtn} ${view === 'business' ? styles.toggleActive : ''}`}
              onClick={() => switchView('business')}
            >
              💼 I offer services
            </button>
          </div>

          {/* Level 2 — flow toggle (sits below, reacts to level 1) */}
          <div className={styles.flowToggle}>
            {view === 'client' ? (
              <>
                <button
                  className={`${styles.flowBtn} ${flow === 'post' ? styles.flowActive : ''}`}
                  onClick={() => setFlow('post')}
                >
                  Post a job
                </button>
                <button
                  className={`${styles.flowBtn} ${flow === 'browse' ? styles.flowActive : ''}`}
                  onClick={() => setFlow('browse')}
                >
                  Browse nearby
                </button>
              </>
            ) : (
              <>
                <button
                  className={`${styles.flowBtn} ${flow === 'respond' ? styles.flowActive : ''}`}
                  onClick={() => setFlow('respond')}
                >
                  Respond to posts
                </button>
                <button
                  className={`${styles.flowBtn} ${flow === 'discover' ? styles.flowActive : ''}`}
                  onClick={() => setFlow('discover')}
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

      {/* ── Footer ── */}
      <Footer />

    </div>
  )
}
