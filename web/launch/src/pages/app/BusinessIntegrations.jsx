import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Plug, Lightning, Robot, ChartBar, Envelope, ArrowRight } from '@phosphor-icons/react'
import Input from '../../components/Input'
import Button from '../../components/Button'
import Badge from '../../components/Badge'
import styles from './Dashboard.module.css'

const INTEGRATIONS = [
  { id: 'zapier', name: 'Zapier', description: 'Connect SwingBy events to 6,000+ apps. Automate follow-ups, CRM updates, and more.', icon: Lightning, status: 'coming-soon' },
  { id: 'slack', name: 'Slack', description: 'Get booking notifications and alerts in your Slack workspace.', icon: Envelope, status: 'coming-soon' },
  { id: 'google-analytics', name: 'Google Analytics', description: 'Track client conversions and booking funnels in Google Analytics 4.', icon: ChartBar, status: 'coming-soon' },
  { id: 'make', name: 'Make (Integromat)', description: 'Build complex automations with Make scenarios triggered by SwingBy events.', icon: Robot, status: 'coming-soon' },
]

const WEBHOOK_EVENTS = [
  'booking.created',
  'booking.confirmed',
  'booking.completed',
  'booking.cancelled',
  'interest.accepted',
  'interest.rejected',
  'review.created',
  'payment.released',
]

const webhookSchema = z.object({
  url: z.string().url('Must be a valid HTTPS URL').refine(v => v.startsWith('https://'), 'Webhook URL must use HTTPS'),
  events: z.array(z.string()).min(1, 'Select at least one event'),
  secret: z.string().min(16, 'Secret must be at least 16 characters').optional().or(z.literal('')),
})

export default function BusinessIntegrations() {
  const [showWebhookForm, setShowWebhookForm] = useState(false)
  const [savedWebhooks, setSavedWebhooks] = useState([])

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(webhookSchema),
    defaultValues: { url: '', events: [], secret: '' },
  })

  void watch('events')

  function onSave(data) {
    // TODO (HUMAN): add POST /webhooks endpoint + docs/wave-N-webhooks.sql migration
    const webhook = { id: crypto.randomUUID(), ...data, created_at: new Date().toISOString(), status: 'active' }
    setSavedWebhooks(prev => [...prev, webhook])
    toast.success('Webhook saved. (Stored locally — backend endpoint pending.)')
    reset()
    setShowWebhookForm(false)
  }

  function removeWebhook(id) {
    setSavedWebhooks(prev => prev.filter(w => w.id !== id))
    toast.success('Webhook removed.')
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Integrations</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 'var(--space-sm) 0 var(--space-xl)' }}>
        Connect SwingBy to your existing tools and automate your workflow.
      </p>

      {/* Integration gallery */}
      <section>
        <h2 className={styles.sectionTitle}>Available integrations</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-2xl)' }}>
          {INTEGRATIONS.map(({ id, name, description, icon: Icon }) => (
            <div key={id} style={{ display: 'flex', gap: 'var(--space-md)', padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: 44, height: 44, background: 'var(--color-accent-muted)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={22} style={{ color: 'var(--color-accent-text)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{name}</span>
                  <Badge variant="roadmap">Coming soon</Badge>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Webhooks */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <div>
            <h2 className={styles.sectionTitle} style={{ marginBottom: '4px' }}>Webhooks</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Receive real-time HTTP POST notifications for SwingBy events.</p>
          </div>
          <Button variant="secondary" size="sm" icon={<Plug size={15} />} onClick={() => setShowWebhookForm(v => !v)}>
            {showWebhookForm ? 'Cancel' : 'Add webhook'}
          </Button>
        </div>

        {showWebhookForm && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
            <form onSubmit={handleSubmit(onSave)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <Input label="Endpoint URL (HTTPS)" placeholder="https://your-server.com/webhooks/swingby" error={errors.url?.message} {...register('url')} />

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>Events to listen for</label>
                {errors.events && <span style={{ fontSize: '12px', color: 'var(--color-danger)', display: 'block', marginBottom: '8px' }}>{errors.events.message}</span>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {WEBHOOK_EVENTS.map(evt => (
                    <label key={evt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                      <input type="checkbox" value={evt} {...register('events')} style={{ accentColor: 'var(--color-accent)', width: 14, height: 14 }} />
                      <code style={{ fontSize: '12px', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px' }}>{evt}</code>
                    </label>
                  ))}
                </div>
              </div>

              <Input label="Signing secret (optional, ≥16 chars)" type="password" placeholder="Used to verify the webhook signature" error={errors.secret?.message} {...register('secret')} />

              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <Button type="submit" loading={isSubmitting}>Save webhook</Button>
                <Button type="button" variant="ghost" onClick={() => { setShowWebhookForm(false); reset() }}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        {savedWebhooks.length === 0 ? (
          <div style={{ padding: 'var(--space-xl)', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <Plug size={36} style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }} />
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>No webhooks configured. Add one to receive real-time event notifications.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {savedWebhooks.map(wh => (
              <div key={wh.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <code style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{wh.url}</code>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    {wh.events.length} event{wh.events.length !== 1 ? 's' : ''} · Added {wh.created_at ? new Date(wh.created_at).toLocaleDateString() : 'just now'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge variant="success">Active</Badge>
                  <Button variant="ghost" size="sm" onClick={() => removeWebhook(wh.id)}>Remove</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Docs link */}
      <div style={{ marginTop: 'var(--space-2xl)', padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>SwingBy API</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Build custom integrations with your API keys.</div>
        </div>
        <a href="/app/settings/api-keys" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--color-accent-text)', textDecoration: 'none', fontWeight: 500 }}>
          API keys <ArrowRight size={14} />
        </a>
      </div>
    </div>
  )
}
