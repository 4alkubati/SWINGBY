import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import SEO from '../components/SEO'
import Button from '../components/Button'
import Input from '../components/Input'
import { sendPasswordReset } from '../lib/auth'

const schema = z.object({ email: z.string().email('Enter a valid email') })

export default function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })
  const email = watch('email')

  async function onSubmit({ email }) {
    await sendPasswordReset(email)
    setSent(true)
  }

  return (
    <>
      <SEO title="Forgot password" noindex />
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4xl) var(--space-lg)' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <Link to="/login" style={{ color: 'var(--color-accent-text)', fontSize: '13px', display: 'block', marginBottom: 'var(--space-xl)' }}>← Back to sign in</Link>
          {sent ? (
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--color-text-primary)', marginBottom: '12px' }}>Check your inbox</h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>A password reset link was sent to <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>. Check your spam folder if you don't see it.</p>
              <Link to="/login" style={{ display: 'inline-block', marginTop: 'var(--space-xl)', color: 'var(--color-accent-text)' }}>Back to sign in</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--color-text-primary)', marginBottom: '4px' }}>Forgot password</h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: 'var(--space-xl)' }}>Enter your email and we'll send a reset link.</p>
              <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <Input label="Email" type="email" placeholder="your@email.com" autoComplete="email" error={errors.email?.message} {...register('email')} />
                <Button type="submit" loading={isSubmitting}>Send reset link</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
