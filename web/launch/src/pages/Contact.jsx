import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import SEO from '../components/SEO'
import Button from '../components/Button'
import Input from '../components/Input'
import api from '../lib/api'
import styles from './page.module.css'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

// F065 fix (2026-08-11): this used to `await` a fake 800ms timeout and toast
// success without ever calling the backend — `_data` was never even read.
// `POST /contact/` is real (`backend/app/api/contact.py:38`) and pre-launch's
// Contact.jsx already calls it correctly; this form just never did. The
// backend's `topic` field is required but falls back to "general" for
// anything outside its known set (`contact.py:41-43`), so it's sent as a
// fixed value rather than adding a topic picker this form never had.
export default function Contact() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data) {
    try {
      await api.post('/contact/', { ...data, topic: 'general' })
      toast.success('Message sent. We\'ll reply within one business day.')
      reset()
    } catch {
      toast.error('Could not send your message. Please try again.')
    }
  }

  return (
    <>
      <SEO title="Contact" description="Get in touch with the SwingBy team." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>Contact us</h1>
          <p className={styles.pageSubtitle}>Questions, feedback, or partnership inquiries — we'd love to hear from you.</p>
        </div>
        <div style={{ maxWidth: '560px', margin: '0 auto var(--space-3xl)' }}>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} noValidate>
            <Input label="Name" placeholder="Your name" error={errors.name?.message} {...register('name')} />
            <Input label="Email" type="email" placeholder="your@email.com" error={errors.email?.message} autoComplete="email" {...register('email')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Message</label>
              <textarea
                rows={5}
                placeholder="Tell us what's on your mind…"
                style={{ padding: 'var(--space-md) var(--space-base)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px', resize: 'vertical' }}
                {...register('message')}
              />
              {errors.message && <p style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{errors.message.message}</p>}
            </div>
            <Button type="submit" loading={isSubmitting}>Send message</Button>
          </form>
          <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>You can also email us directly:</p>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <a href="mailto:hello@swingbyy.com" style={{ color: 'var(--color-accent-text)', fontSize: '14px' }}>hello@swingbyy.com</a>
              <a href="mailto:support@swingbyy.com" style={{ color: 'var(--color-accent-text)', fontSize: '14px' }}>support@swingbyy.com</a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
