import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './Login.module.css'

export default function Login() {
  const navigate = useNavigate()

  // Email/password form state
  const [form, setForm] = useState({ email: '', password: '' })
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [errMsg, setErrMsg] = useState('')

  // Magic link state
  const [magicEmail, setMagicEmail] = useState('')
  const [magicStatus, setMagicStatus] = useState('idle') // idle | loading | sent | error
  const [magicErr, setMagicErr] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setErrMsg('')

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    })

    if (error) {
      setErrMsg(error.message)
      setStatus('error')
    } else {
      navigate('/dashboard')
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    if (!magicEmail.trim()) return
    setMagicStatus('loading')
    setMagicErr('')

    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setMagicErr(error.message)
      setMagicStatus('error')
    } else {
      setMagicStatus('sent')
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Left panel: brand/visual ── */}
      <aside className={styles.leftPanel} aria-hidden="true">
        <Link to="/" className={styles.leftLogo} tabIndex={-1}>SwingBy</Link>

        <div className={styles.leftContent}>
          <h1 className={styles.leftHeadline}>Welcome back to SwingBy</h1>
          <p className={styles.leftSubtitle}>Your local services marketplace</p>

          <div className={styles.featurePills}>
            <span className={styles.pill}>
              <span className={styles.pillDot} />
              Trusted local providers
            </span>
            <span className={styles.pill}>
              <span className={styles.pillDot} />
              Book in minutes
            </span>
            <span className={styles.pill}>
              <span className={styles.pillDot} />
              Secure &amp; transparent
            </span>
          </div>
        </div>

        <blockquote className={styles.testimonial}>
          <p className={styles.testimonialQuote}>
            "SwingBy made finding a cleaner so simple. Booked in 10 minutes."
          </p>
          <footer className={styles.testimonialAuthor}>— Sarah M., Calgary</footer>
        </blockquote>
      </aside>

      {/* ── Right panel: form ── */}
      <main className={styles.rightPanel}>
        <div className={styles.rightTopBar}>
          <Link to="/signup" className={styles.signupLink}>
            No account? Sign up free →
          </Link>
        </div>

        <div className={styles.rightContent}>
          <div className={styles.formCard}>
            <h2 className={styles.formHeading}>Log in</h2>
            <p className={styles.formSubtitle}>Sign in to continue.</p>

            {/* ── Magic link ── */}
            <div>
              <span className={styles.sectionLabel}>Email me a link</span>
              <form onSubmit={handleMagicLink}>
                <div className={styles.magicRow}>
                  <input
                    type="email"
                    className={`${styles.magicInput}${magicStatus === 'sent' ? ` ${styles.magicSent}` : ''}`}
                    value={magicEmail}
                    onChange={e => setMagicEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    aria-label="Email for magic link"
                    disabled={magicStatus === 'loading' || magicStatus === 'sent'}
                  />
                  <button
                    type="submit"
                    className={styles.sendLinkBtn}
                    disabled={magicStatus === 'loading' || magicStatus === 'sent' || !magicEmail.trim()}
                  >
                    {magicStatus === 'loading' ? 'Sending…' : magicStatus === 'sent' ? 'Sent ✓' : 'Send link'}
                  </button>
                </div>
              </form>
              {magicStatus === 'sent' && (
                <p className={styles.magicSuccess}>
                  ✓ Check your inbox — link sent to {magicEmail}
                </p>
              )}
              {magicStatus === 'error' && magicErr && (
                <div className={styles.errorMsg} role="alert">{magicErr}</div>
              )}
            </div>

            {/* ── Divider ── */}
            <div className={styles.divider} role="separator" aria-label="or">
              <div className={styles.dividerLine} />
              <span className={styles.dividerText}>or</span>
              <div className={styles.dividerLine} />
            </div>

            {/* ── Email / password form ── */}
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              {status === 'error' && errMsg && (
                <div className={styles.errorMsg} role="alert">{errMsg}</div>
              )}

              {/* ── Social placeholders ── */}
              <div className={styles.socialGroup}>
                <button
                  type="button"
                  className={styles.socialBtn}
                  aria-disabled="true"
                  aria-label="Continue with Apple — coming soon"
                  tabIndex={-1}
                >
                  <span className={styles.socialIcon} aria-hidden="true"></span>
                  Continue with Apple
                  <span className={styles.comingSoonTag} aria-hidden="true">Soon</span>
                </button>
                <button
                  type="button"
                  className={styles.socialBtn}
                  aria-disabled="true"
                  aria-label="Continue with Google — coming soon"
                  tabIndex={-1}
                >
                  <span className={styles.socialIcon} aria-hidden="true">G</span>
                  Continue with Google
                  <span className={styles.comingSoonTag} aria-hidden="true">Soon</span>
                </button>
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Logging in…' : 'Log in →'}
              </button>
            </form>

            <div className={styles.formFooter}>
              <Link to="/forgot-password" className={styles.forgotLink}>
                Forgot password?
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
