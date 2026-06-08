import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useUser } from '../../hooks/useUser'
import api from '../../lib/api'
import Input from '../../components/Input'
import Button from '../../components/Button'
import Spinner from '../../components/Spinner'
import styles from './Dashboard.module.css'

const schema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
})

export default function Profile() {
  const { data: user, isLoading } = useUser()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    values: { first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '' },
  })

  const save = useMutation({
    mutationFn: (data) => api.patch('/auth/me', data),
    onSuccess: () => { qc.invalidateQueries(['me']); toast.success('Profile updated.') },
    onError: () => toast.error('Could not save profile.'),
  })

  if (isLoading) return <Spinner />

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1 className={styles.pageTitle}>Profile</h1>
      <div style={{ marginBottom: 'var(--space-xl)', display: 'flex', align: 'center', gap: 'var(--space-md)' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, color: 'var(--color-accent-text)' }}>
          {user?.first_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.first_name} {user?.last_name}</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{user?.email} · {user?.role?.replace('_', ' ')}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit(d => save.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input label="First name" error={errors.first_name?.message} {...register('first_name')} />
          <Input label="Last name" error={errors.last_name?.message} {...register('last_name')} />
        </div>
        <div>
          <label style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email</label>
          <p style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{user?.email}</p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Email cannot be changed here.</p>
        </div>
        <Input label="Phone (optional, E.164 format: +15551234567)" error={errors.phone?.message} {...register('phone')} />
        <Button type="submit" loading={save.isPending || isSubmitting}>Save changes</Button>
      </form>
    </div>
  )
}
