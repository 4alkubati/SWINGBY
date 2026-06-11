import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Key, Plus, Eye, EyeSlash, CopySimple, Trash } from '@phosphor-icons/react'
import Input from '../../components/Input'
import Button from '../../components/Button'
import Alert from '../../components/Alert'
import styles from './Dashboard.module.css'

// TODO (HUMAN): Implement backend endpoints:
//   POST   /api-keys        { name } → { id, name, key, created_at }
//   GET    /api-keys        → [{ id, name, key_prefix, created_at, last_used_at }]
//   DELETE /api-keys/{id}
//   Migration: docs/wave-N-api-keys.sql
//   Rate limit: 60 req/min per key on analytics endpoints

const schema = z.object({
  name: z.string().min(1, 'Name required').max(60, 'Max 60 characters'),
})

function maskKey(key) {
  if (!key || key.length < 12) return key
  return `${key.slice(0, 8)}${'•'.repeat(20)}${key.slice(-4)}`
}

export default function ApiKeys() {
  const [keys, setKeys] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [revealed, setRevealed] = useState({})

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  })

  function onCreate(data) {
    // TODO (HUMAN): replace with API call — api.post('/api-keys', { name: data.name })
    const generated = `swb_live_${crypto.randomUUID().replace(/-/g, '')}`
    const key = { id: crypto.randomUUID(), name: data.name, key: generated, key_prefix: generated.slice(0, 12), created_at: new Date().toISOString(), last_used_at: null }
    setKeys(prev => [...prev, key])
    setNewKey(generated)
    reset()
    setShowForm(false)
    toast.success('API key created. Copy it now — it won\'t be shown again.')
  }

  function copyKey(k) {
    navigator.clipboard.writeText(k).then(() => toast.success('Copied to clipboard.')).catch(() => toast.error('Copy failed.'))
  }

  function deleteKey(id) {
    // TODO (HUMAN): replace with api.delete(`/api-keys/${id}`)
    setKeys(prev => prev.filter(k => k.id !== id))
    toast.success('API key revoked.')
  }

  return (
    <div style={{ maxWidth: '680px' }}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>API keys</h1>
          <p className={styles.pageSubtitle}>Use API keys to authenticate requests to the SwingBy API</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => { setShowForm(v => !v); setNewKey(null) }}>
          {showForm ? 'Cancel' : 'New key'}
        </Button>
      </div>

      <Alert type="warning" message="API keys grant full access to your business data. Never expose them in client-side code, public repos, or browser consoles." />

      {newKey && (
        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-lg)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Key size={16} style={{ color: 'var(--color-success)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>Key created — copy it now</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <code style={{ flex: 1, fontSize: '13px', background: 'var(--color-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>{newKey}</code>
            <Button variant="ghost" size="sm" icon={<CopySimple size={15} />} onClick={() => copyKey(newKey)}>Copy</Button>
          </div>
          <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>This is the only time you'll see the full key. Store it securely.</p>
        </div>
      )}

      {showForm && (
        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-md)' }}>Create API key</h2>
          <form onSubmit={handleSubmit(onCreate)} noValidate style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input label="Key name" placeholder="e.g. Zapier integration" error={errors.name?.message} {...register('name')} />
            </div>
            <Button type="submit" loading={isSubmitting} style={{ marginBottom: errors.name ? '20px' : '0' }}>Create</Button>
          </form>
        </div>
      )}

      <div style={{ marginTop: 'var(--space-xl)' }}>
        {keys.length === 0 ? (
          <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <Key size={40} style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }} />
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>No API keys yet. Create one to start building integrations.</p>
          </div>
        ) : (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Name', 'Key', 'Created', 'Last used', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((k, i) => (
                  <tr key={k.id} style={{ borderBottom: i < keys.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{k.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <code style={{ fontSize: '12px', color: 'var(--color-text-secondary)', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: '4px' }}>
                          {revealed[k.id] ? k.key : maskKey(k.key)}
                        </code>
                        <button onClick={() => setRevealed(p => ({ ...p, [k.id]: !p[k.id] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', padding: 0 }} aria-label={revealed[k.id] ? 'Hide key' : 'Reveal key'}>
                          {revealed[k.id] ? <EyeSlash size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={() => copyKey(k.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', padding: 0 }} aria-label="Copy key">
                          <CopySimple size={14} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {k.created_at ? new Date(k.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => { if (confirm('Revoke this API key? This cannot be undone.')) deleteKey(k.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500 }} aria-label="Revoke key">
                        <Trash size={14} /> Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>Security guidelines</h2>
        <ul style={{ paddingLeft: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <li>Treat API keys like passwords — store them in a secure secrets manager.</li>
          <li>Never commit keys to source control or include them in client-side bundles.</li>
          <li>Rotate keys regularly and immediately if you suspect a leak.</li>
          <li>Each key is rate-limited to 60 requests per minute on analytics endpoints.</li>
        </ul>
      </div>
    </div>
  )
}
