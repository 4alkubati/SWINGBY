import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Input from '../../components/Input'
import Button from '../../components/Button'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import styles from './Dashboard.module.css'

const CATEGORIES = ['Cleaning', 'Plumbing', 'Electrical', 'Landscaping', 'Painting', 'Carpentry', 'Handyman', 'Moving', 'Auto services', 'Other']

const schema = z.object({
  business_name: z.string().min(1, 'Required').max(120),
  category: z.string().min(1, 'Required'),
  description: z.string().max(800).optional(),
  service_radius_km: z.number().positive().max(500),
})

export default function BusinessProfile() {
  const qc = useQueryClient()

  const { data: biz, isLoading, isError } = useQuery({
    queryKey: ['myBusiness'],
    queryFn: () => api.get('/businesses/me').then(r => r.data),
  })

  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset } = useForm({
    resolver: zodResolver(schema),
    values: biz ? {
      business_name: biz.business_name ?? '',
      category: biz.category ?? '',
      description: biz.description ?? '',
      service_radius_km: biz.service_radius_km ?? 25,
    } : undefined,
  })

  const update = useMutation({
    mutationFn: (data) => api.patch(`/businesses/${biz.id}`, data),
    onSuccess: (res) => {
      qc.setQueryData(['myBusiness'], res.data)
      toast.success('Profile updated.')
      reset(res.data)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Could not save changes'),
  })

  if (isLoading) return <Spinner />
  if (isError) return <Alert type="error" message="Could not load your business profile." />

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 className={styles.pageTitle}>Business profile</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 'var(--space-sm) 0 var(--space-xl)' }}>
        Changes apply immediately to your public listing.
      </p>

      <form onSubmit={handleSubmit(d => update.mutate({ ...d, service_radius_km: Number(d.service_radius_km) }))} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Input label="Business name" error={errors.business_name?.message} {...register('business_name')} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Category</label>
          <select {...register('category')} style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px' }}>
            <option value="">Select a category…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{errors.category.message}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Description (optional)</label>
          <textarea rows={4} {...register('description')} placeholder="Tell clients what makes your service great…" style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px', resize: 'vertical' }} />
          {errors.description && <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{errors.description.message}</span>}
        </div>

        <Input label="Service radius (km)" type="number" error={errors.service_radius_km?.message} {...register('service_radius_km', { valueAsNumber: true })} />

        <div style={{ paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
            Location · <span style={{ color: 'var(--color-text-primary)' }}>{biz.lat?.toFixed(4)}, {biz.lng?.toFixed(4)}</span>
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Location is set during onboarding. Contact support to update it.</p>
        </div>

        <Button type="submit" disabled={!isDirty} loading={update.isPending || isSubmitting}>Save changes</Button>
      </form>
    </div>
  )
}
