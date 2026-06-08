import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import SEO from '../components/SEO'
import Button from '../components/Button'
import Input from '../components/Input'
import { updatePassword } from '../lib/auth'

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters').regex(/[A-Z]/, 'Need uppercase').regex(/[a-z]/, 'Need lowercase').regex(/[0-9]/, 'Need a number'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

export default function ResetPassword() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit({ password }) {
    try {
      await updatePassword(password)
      toast.success('Password updated. Please sign in.')
      navigate('/login')
    } catch (err) {
      setError(err.message || 'Could not update password. Try requesting a new reset link.')
    }
  }

  return (
    <>
      <SEO title="Reset password" noindex />
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4xl) var(--space-lg)' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-xl)' }}>Set new password</h1>
          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <Input label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
            <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
            {error && <div style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{error}</div>}
            <Button type="submit" loading={isSubmitting}>Update password</Button>
          </form>
        </div>
      </div>
    </>
  )
}
