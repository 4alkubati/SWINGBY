import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Input from '../../components/Input'
import Button from '../../components/Button'
import styles from './Dashboard.module.css'

const CATEGORIES = ['Cleaning', 'Plumbing', 'Electrical', 'Landscaping', 'Painting', 'Carpentry', 'Handyman', 'Moving', 'Auto services', 'Other']

const schema = z.object({
  title: z.string().min(5, 'Describe your job in at least 5 characters').max(200),
  category: z.string().min(1, 'Pick a category'),
  budget: z.number({ invalid_type_error: 'Enter a number' }).positive('Budget must be positive'),
})

export default function PostJob() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { title: '', category: '', budget: '' },
  })

  const post = useMutation({
    mutationFn: (data) => api.post('/service-posts/', data),
    onSuccess: () => { toast.success('Job posted!'); navigate('/app/bookings') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Could not post job'),
  })

  async function onSubmit(data) {
    post.mutate({ ...data, budget: Number(data.budget) })
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 className={styles.pageTitle}>Post a job</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 'var(--space-sm) 0 var(--space-xl)' }}>Describe what you need. Local businesses will send you quotes.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <Input label="Describe your job" placeholder="e.g. Deep clean 3-bedroom apartment, including oven and fridge" error={errors.title?.message} {...register('title')} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Category</label>
          <select {...register('category')} style={{ padding: '10px 14px', background: 'var(--color-surface)', border: `1px solid ${errors.category ? 'var(--color-danger)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px' }}>
            <option value="">Select a category…</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <p style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{errors.category.message}</p>}
        </div>
        <Input label="Budget ($)" type="number" placeholder="e.g. 150" error={errors.budget?.message} {...register('budget', { valueAsNumber: true })} />
        <Button type="submit" loading={post.isPending || isSubmitting}>Post job</Button>
      </form>
    </div>
  )
}
