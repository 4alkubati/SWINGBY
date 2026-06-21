import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './Signup.module.css'

const ROLES = [
  {
    id: 'client',
    icon: '🔍',
    title: 'Find a service',
    desc: 'Post jobs, get quotes from local businesses',
  },
  {
    id: 'business_owner',
    icon: '💼',
    title: 'Offer services',
    desc: 'Get discovered, respond to job posts, grow your business',
  },
]

export default function Signup() {
  const navigate = useNavigate()

  // Step: 1 = role picker, 2 = account details, 3 = success
  const [step, setStep] = useState(1)
  const [animKey, setAnimKey] = useState(0)

  const [role, setRole] = useState(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
  })
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')

  function advanceTo(nextStep) {
    setAnimKey(k => k + 1)
    setStep(nextStep)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) {
      setErrMsg('Password must be at least 8 characters.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setErrMsg('')

    const emailTrimmed = form.email.trim()
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: emailTrimmed,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role,
        },
      },
    })

    if (error) {
      setErrMsg(error.message)
      setStatus('error')
    } else {
      advanceTo(3)
      // If Supabase returns a confirmed session (confirm-email OFF), go to dashboard.
      // Otherwise route to /verify-email so the user knows the inbox is the next step.
      const isConfirmed = !!signUpData?.session && !!signUpData?.user?.email_confirmed_at
      setTimeout(() => {
        if (isConfirmed) {
          navigate('/dashboard', { replace: true })
        } else {
          navigate('/verify-email', { replace: true, state: { email: emailTrimmed } })
        }
      }, 1500)
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Left panel ── */}
      <div className={styles.leftPanel}>
        <div className={styles.leftOrb} />
        <div className={styles.leftOrb2} />

        <Link to="/" className={styles.leftLogo}>SwingBy</Link>

        <div className={styles.leftContent}>
          <h1 className={styles.leftHeadline}>Join SwingBy</h1>
          <p className={styles.leftSubtitle}>Be first when we launch in your city.</p>
        </div>

        <div className={styles.leftTestimonial}>
          <p className={styles.testimonialQuote}>
            "I'm a one-person shop. SwingBy fills my calendar without me lifting a finger."
          </p>
          <p className={styles.testimonialAuthor}>— Ahmed K., Painter</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className={styles.rightPanel}>
        <nav className={styles.rightNav}>
          <Link to="/login" className={styles.loginLink}>
            Already have an account? <span>Log in</span>
          </Link>
        </nav>

        <div className={styles.formArea}>
          <div className={styles.formInner}>

            {/* Step 1 — Role selection */}
            {step === 1 && (
              <div key={`step-1-${animKey}`} className={`${styles.step} ${styles.stepEnter}`}>
                <h2 className={styles.stepHeading}>I want to…</h2>

                <div className={styles.roleCards}>
                  {ROLES.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      className={`${styles.roleCard} ${role === r.id ? styles.roleCardSelected : ''}`}
                      onClick={() => setRole(r.id)}
                    >
                      <span className={styles.roleCardIcon}>{r.icon}</span>
                      <span className={styles.roleCardBody}>
                        <span className={styles.roleCardTitle}>{r.title}</span>
                        <span className={styles.roleCardDesc}>{r.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!role}
                  onClick={() => advanceTo(2)}
                >
                  Continue →
                </button>
              </div>
            )}

            {/* Step 2 — Account details */}
            {step === 2 && (
              <div key={`step-2-${animKey}`} className={`${styles.step} ${styles.stepEnter}`}>
                <h2 className={styles.stepHeading}>Create your account</h2>

                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label htmlFor="first_name">First name</label>
                      <input
                        id="first_name"
                        type="text"
                        name="first_name"
                        value={form.first_name}
                        onChange={handleChange}
                        placeholder="First"
                        required
                        autoComplete="given-name"
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="last_name">Last name</label>
                      <input
                        id="last_name"
                        type="text"
                        name="last_name"
                        value={form.last_name}
                        onChange={handleChange}
                        placeholder="Last"
                        required
                        autoComplete="family-name"
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Min. 8 characters"
                      required
                      autoComplete="new-password"
                    />
                    <span className={styles.fieldHint}>Must be at least 8 characters</span>
                  </div>

                  {status === 'error' && (
                    <div className={styles.errorMsg}>{errMsg}</div>
                  )}

                  <button
                    type="submit"
                    className={styles.primaryBtn}
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? 'Creating account…' : 'Create account →'}
                  </button>
                </form>
              </div>
            )}

            {/* Step 3 — Success */}
            {step === 3 && (
              <div key={`step-3-${animKey}`} className={`${styles.step} ${styles.stepEnter}`}>
                <div className={styles.successWrap}>
                  <div className={styles.successIcon}>✓</div>
                  <h2 className={styles.successHeading}>Account created!</h2>
                  <p className={styles.successBody}>
                    Check your email to confirm, then you'll be redirected.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
