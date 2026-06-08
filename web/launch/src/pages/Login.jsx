import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import SEO from '../components/SEO'
import Button from '../components/Button'
import Input from '../components/Input'
import { loginWithPassword, loginWithMagicLink } from '../lib/auth'
import styles from './Auth.module.css'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

const RATE_LIMIT_MS = 60_000

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/app/dashboard'
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  const [serverError, setServerError] = useState('')
  const [magicEmail, setMagicEmail] = useState('')
  const [magicState, setMagicState] = useState('idle')

  // Client-side brute-force throttle
  const attempts = useRef([])

  function isThrottled() {
    const now = Date.now()
    attempts.current = attempts.current.filter(t => now - t < RATE_LIMIT_MS)
    return attempts.current.length >= 5
  }

  async function onSubmit({ email, password }) {
    if (isThrottled()) {
      setServerError('Too many attempts. Wait a minute and try again.')
      return
    }
    setServerError('')
    try {
      await loginWithPassword(email, password)
      navigate(next)
    } catch (err) {
      attempts.current.push(Date.now())
      setServerError('Invalid email or password.')
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    if (!magicEmail.trim()) return
    setMagicState('loading')
    try {
      await loginWithMagicLink(magicEmail)
      setMagicState('sent')
    } catch {
      setMagicState('error')
      toast.error('Could not send magic link. Check the email address.')
    }
  }

  return (
    <>
      <SEO title="Sign in" noindex />
      <div className={styles.page}>
        <aside className={styles.panel} aria-hidden="true">
          <Link to="/" className={styles.panelLogo} tabIndex={-1}>SwingBy</Link>
          <div className={styles.panelContent}>
            <h1 className={styles.panelHeadline}>Welcome back</h1>
            <p className={styles.panelSub}>Your local services marketplace</p>
            <div className={styles.pills}>
              <span className={styles.pill}>Vetted local providers</span>
              <span className={styles.pill}>Book in minutes</span>
              <span className={styles.pill}>Safe escrow payments</span>
            </div>
          </div>
          <blockquote className={styles.testimonial}>
            <p>"SwingBy made finding a cleaner so simple. Booked in 10 minutes."</p>
            <footer>— Sarah M., Calgary</footer>
          </blockquote>
        </aside>

        <main className={styles.formArea}>
          <div className={styles.topBar}>
            <Link to="/signup" className={styles.altLink}>No account? Sign up free →</Link>
          </div>
          <div className={styles.formCard}>
            <h2 className={styles.formHeading}>Sign in</h2>
            <p className={styles.formSub}>Enter your email and password to continue.</p>

            {/* Magic link */}
            <div className={styles.magicSection}>
              <span className={styles.sectionLabel}>Email me a sign-in link</span>
              {magicState === 'sent' ? (
                <p className={styles.magicSuccess}>Link sent to {magicEmail} — check your inbox.</p>
              ) : (
                <form onSubmit={handleMagicLink} className={styles.magicRow}>
                  <input
                    type="email"
                    className={styles.magicInput}
                    value={magicEmail}
                    onChange={e => setMagicEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    disabled={magicState === 'loading'}
                    aria-label="Email for magic link"
                  />
                  <button type="submit" className={styles.magicBtn} disabled={magicState === 'loading' || !magicEmail.trim()}>
                    {magicState === 'loading' ? 'Sending…' : 'Send link'}
                  </button>
                </form>
              )}
            </div>

            <div className={styles.divider} role="separator">
              <div className={styles.divLine} />
              <span className={styles.divText}>or</span>
              <div className={styles.divLine} />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className={styles.form}>
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Your password"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />

              {serverError && (
                <div className={styles.errorBanner} role="alert">{serverError}</div>
              )}

              <Button type="submit" loading={isSubmitting} style={{ width: '100%' }}>
                Sign in
              </Button>
            </form>

            <div className={styles.formFooter}>
              <Link to="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
