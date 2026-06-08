import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import SEO from '../components/SEO'
import Button from '../components/Button'
import Input from '../components/Input'
import { signup } from '../lib/auth'
import styles from './Auth.module.css'

const baseSchema = {
  first_name: z.string().min(1, 'Required').max(80),
  last_name: z.string().min(1, 'Required').max(80),
  email: z.string().email('Enter a valid email'),
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[a-z]/, 'Must include a lowercase letter')
    .regex(/[0-9]/, 'Must include a number'),
}

const clientSchema = z.object({ ...baseSchema })
const bizSchema = z.object({ ...baseSchema, business_name: z.string().min(1, 'Business name is required').max(120) })

function passwordStrength(password) {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong']
const STRENGTH_COLORS = ['', '#FF5C5C', '#F6B23B', '#F6B23B', '#2EBD85', '#2EBD85']

export default function Signup() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('client')
  const isBiz = tab === 'business'
  const schema = isBiz ? bizSchema : clientSchema

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { first_name: '', last_name: '', email: '', password: '', business_name: '' },
  })

  const [serverError, setServerError] = useState('')
  const pwd = watch('password') || ''
  const strength = passwordStrength(pwd)

  async function onSubmit(data) {
    setServerError('')
    try {
      const payload = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        password: data.password,
        role: isBiz ? 'business_owner' : 'client',
      }
      await signup(payload)
      if (isBiz && data.business_name) {
        toast.success('Account created! Complete your business profile.')
        navigate('/app/business/onboarding')
      } else {
        toast.success('Account created! Welcome to SwingBy.')
        navigate('/app/dashboard')
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Could not create account'
      setServerError(typeof msg === 'string' ? msg : 'Could not create account. Try again.')
    }
  }

  return (
    <>
      <SEO title="Create account" noindex />
      <div className={styles.page}>
        <aside className={styles.panel} aria-hidden="true">
          <Link to="/" className={styles.panelLogo} tabIndex={-1}>SwingBy</Link>
          <div className={styles.panelContent}>
            <h1 className={styles.panelHeadline}>Join SwingBy</h1>
            <p className={styles.panelSub}>
              {isBiz ? 'List your business. Get warm leads. Pay only when you earn.' : 'Post jobs. Get quotes. Book local pros with confidence.'}
            </p>
            <div className={styles.pills}>
              {isBiz
                ? ['Free to list', '10% fee on completion only', 'Founder pricing available'].map(p => <span key={p} className={styles.pill}>{p}</span>)
                : ['Always free for clients', 'Vetted local businesses', 'Safe escrow payments'].map(p => <span key={p} className={styles.pill}>{p}</span>)
              }
            </div>
          </div>
        </aside>

        <main className={styles.formArea}>
          <div className={styles.topBar}>
            <Link to="/login" className={styles.altLink}>Already have an account? Sign in →</Link>
          </div>
          <div className={styles.formCard}>
            <h2 className={styles.formHeading}>Create account</h2>

            {/* Role tabs */}
            <div className={styles.tabBar}>
              <button className={[styles.tab, tab === 'client' ? styles.active : ''].join(' ')} onClick={() => setTab('client')}>I need services</button>
              <button className={[styles.tab, tab === 'business' ? styles.active : ''].join(' ')} onClick={() => setTab('business')}>I offer services</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className={styles.form}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input label="First name" placeholder="Jane" error={errors.first_name?.message} {...register('first_name')} />
                <Input label="Last name" placeholder="Smith" error={errors.last_name?.message} {...register('last_name')} />
              </div>
              <Input label="Email" type="email" placeholder="your@email.com" autoComplete="email" error={errors.email?.message} {...register('email')} />
              <div>
                <Input label="Password" type="password" placeholder="Min 8 chars, upper, lower, number" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
                {pwd && (
                  <div>
                    <div className={styles.strengthBar}>
                      <div className={styles.strengthFill} style={{ width: `${(strength / 5) * 100}%`, background: STRENGTH_COLORS[strength] }} />
                    </div>
                    <p style={{ fontSize: '11px', color: STRENGTH_COLORS[strength], marginTop: '4px' }}>{STRENGTH_LABELS[strength]}</p>
                  </div>
                )}
              </div>

              {isBiz && (
                <Input label="Business name" placeholder="Your business name" error={errors.business_name?.message} {...register('business_name')} />
              )}

              {serverError && <div className={styles.errorBanner} role="alert">{serverError}</div>}

              <Button type="submit" loading={isSubmitting} style={{ width: '100%' }}>
                {isBiz ? 'Create business account' : 'Create account'}
              </Button>

              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                By creating an account, you agree to our{' '}
                <Link to="/terms" style={{ color: 'var(--color-accent-text)' }}>Terms</Link> and{' '}
                <Link to="/privacy" style={{ color: 'var(--color-accent-text)' }}>Privacy Policy</Link>.
              </p>
            </form>
          </div>
        </main>
      </div>
    </>
  )
}
