import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { UserPlus, UserMinus, ArrowCounterClockwise } from '@phosphor-icons/react'
import api from '../../lib/api'
import Input from '../../components/Input'
import Button from '../../components/Button'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import Badge from '../../components/Badge'
import styles from './Dashboard.module.css'

// Mirrors backend/app/api/employees.py::EmployeeCreate. first_name, last_name
// and password are REQUIRED there with no defaults — the form used to collect
// only email + role_title, so every submission was rejected by FastAPI
// validation before add_employee ever ran and no owner could add anyone on web.
const schema = z.object({
  first_name: z.string().min(1, 'First name required').max(80),
  last_name: z.string().min(1, 'Last name required').max(80),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters').max(128),
  role_title: z.string().min(1, 'Role title required').max(60),
})

export default function BusinessEmployees() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: employees, isLoading, isError } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees/').then(r => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { first_name: '', last_name: '', email: '', password: '', role_title: '' },
  })

  const invite = useMutation({
    // Normalised the same way the mobile Add Employee sheet does, so the same
    // person typed on either client lands as one account.
    mutationFn: (data) => api.post('/employees/', {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      ...(data.role_title.trim() ? { role_title: data.role_title.trim() } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries(['employees'])
      toast.success('Employee added.')
      reset()
      setShowForm(false)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Could not add employee'),
  })

  const deactivate = useMutation({
    mutationFn: (id) => api.patch(`/employees/${id}/deactivate`),
    onSuccess: () => { qc.invalidateQueries(['employees']); toast.success('Employee deactivated.') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Could not deactivate'),
  })

  const reactivate = useMutation({
    mutationFn: (id) => api.patch(`/employees/${id}/reactivate`),
    onSuccess: () => { qc.invalidateQueries(['employees']); toast.success('Employee reactivated.') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Could not reactivate'),
  })

  const active = (employees ?? []).filter(e => e.is_active)
  const inactive = (employees ?? []).filter(e => !e.is_active)

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Team</h1>
          <p className={styles.pageSubtitle}>Manage who can be assigned to bookings</p>
        </div>
        <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : 'Add employee'}
        </Button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)', maxWidth: '480px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-md)' }}>Add a team member</h2>
          <form onSubmit={handleSubmit(d => invite.mutate(d))} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <Input label="First name" placeholder="Jane" error={errors.first_name?.message} {...register('first_name')} />
            <Input label="Last name" placeholder="Doe" error={errors.last_name?.message} {...register('last_name')} />
            <Input label="Email address" type="email" placeholder="employee@example.com" error={errors.email?.message} {...register('email')} />
            <Input label="Temporary password" type="password" placeholder="At least 8 characters" error={errors.password?.message} {...register('password')} />
            <Input label="Role title" placeholder="e.g. Senior Cleaner" error={errors.role_title?.message} {...register('role_title')} />
            <Button type="submit" loading={invite.isPending || isSubmitting}>Add employee</Button>
          </form>
        </div>
      )}

      {isLoading && <Spinner />}
      {isError && <Alert type="error" message="Could not load employees." />}

      {!isLoading && !isError && (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Active ({active.length})</h2>
            {active.length === 0 ? (
              <div style={{ padding: 'var(--space-xl)', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <UserPlus size={36} style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }} />
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>No active employees. Add your first team member above.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {active.map(emp => (
                  <EmployeeRow key={emp.id} emp={emp} onDeactivate={() => deactivate.mutate(emp.id)} isPending={deactivate.isPending} />
                ))}
              </div>
            )}
          </section>

          {inactive.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Inactive ({inactive.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {inactive.map(emp => (
                  <EmployeeRow key={emp.id} emp={emp} inactive onReactivate={() => reactivate.mutate(emp.id)} isPending={reactivate.isPending} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function EmployeeRow({ emp, inactive, onDeactivate, onReactivate, isPending }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-md) var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', gap: 'var(--space-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-accent-text)' }}>
            {(emp.user?.first_name?.[0] || emp.email?.[0] || '?').toUpperCase()}
          </span>
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {emp.user ? `${emp.user.first_name} ${emp.user.last_name}` : emp.email || `Employee #${emp.id.slice(0, 8)}`}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{emp.role_title}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <Badge variant={inactive ? 'default' : 'success'}>{inactive ? 'Inactive' : 'Active'}</Badge>
        {inactive ? (
          <Button variant="ghost" size="sm" icon={<ArrowCounterClockwise size={14} />} loading={isPending} onClick={onReactivate}>Reactivate</Button>
        ) : (
          <Button variant="ghost" size="sm" icon={<UserMinus size={14} />} loading={isPending} onClick={onDeactivate}>Deactivate</Button>
        )}
      </div>
    </div>
  )
}
