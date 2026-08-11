import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Input from '../../components/Input'
import Button from '../../components/Button'
import styles from './Dashboard.module.css'

const CATEGORIES = ['Cleaning', 'Plumbing', 'Electrical', 'Landscaping', 'Painting', 'Carpentry', 'Handyman', 'Moving', 'Auto services', 'Other']

// F098 fix (2026-08-11): this form never collected an address, so every
// business created here landed with lat=null, lng=null and was silently
// invisible on `GET /businesses/nearby` (businesses.py:259-262 skips any row
// with null coordinates) — signup looked like it succeeded while the pin
// never existed. No Places key is needed to fix this: `POST /businesses/`
// already geocodes a plain address string server-side when no lat/lng are
// supplied (businesses.py:175-184, services/geocoding.py::resolve_coordinates),
// so capturing the address text is enough.
const schema = z.object({
  business_name: z.string().min(1).max(120),
  category: z.string().min(1),
  description: z.string().optional(),
  address: z.string().min(1, 'Address is required so clients can find you'),
  service_radius_km: z.number().positive().max(500).default(25),
})

export default function BusinessOnboarding() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { business_name: '', category: '', description: '', address: '', service_radius_km: 25 },
  })

  const create = useMutation({
    mutationFn: (data) => api.post('/businesses/', data),
    onSuccess: () => {
      qc.invalidateQueries(['myBusiness'])
      toast.success('Business created! You\'re live on SwingBy.')
      navigate('/app/dashboard')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Could not create business'),
  })

  async function onSubmit(data) {
    create.mutate({ ...data, service_radius_km: Number(data.service_radius_km) })
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 className={styles.pageTitle}>Set up your business</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 'var(--space-sm) 0 var(--space-xl)' }}>You're almost there. Fill in your business details to go live.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Input label="Business name" placeholder="e.g. Calgary Clean Co." error={errors.business_name?.message} {...register('business_name')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Category</label>
          <select {...register('category')} style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px' }}>
            <option value="">Select a category…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Description (optional)</label>
          <textarea rows={3} {...register('description')} placeholder="Tell clients what makes your service great…" style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px', resize: 'vertical' }} />
        </div>
        <Input label="Business address" placeholder="e.g. 123 8 Ave SW, Calgary, AB" error={errors.address?.message} {...register('address')} />
        <Input label="Service radius (km)" type="number" defaultValue={25} error={errors.service_radius_km?.message} {...register('service_radius_km', { valueAsNumber: true })} />
        <Button type="submit" loading={create.isPending || isSubmitting}>Create my business listing</Button>
      </form>
    </div>
  )
}
