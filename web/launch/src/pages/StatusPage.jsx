import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import SEO from '../components/SEO'
import api from '../lib/api'

export default function StatusPage() {
  const [status, setStatus] = useState('checking')
  const [checked, setChecked] = useState(null)
  const [detail, setDetail] = useState('')

  useEffect(() => {
    check()
  }, [])

  async function check() {
    setStatus('checking')
    const now = new Date()
    try {
      const res = await api.get('/health')
      setStatus(res.data?.status === 'ok' ? 'up' : 'degraded')
      setDetail(res.data?.database === 'connected' ? 'All systems operational' : 'Database issue detected')
    } catch {
      setStatus('down')
      setDetail('API unreachable')
    }
    setChecked(now)
  }

  const statusColor = { up: 'var(--color-success)', degraded: 'var(--color-warning)', down: 'var(--color-danger)', checking: 'var(--color-text-secondary)' }[status]
  const statusLabel = { up: 'All systems operational', degraded: 'Partial degradation', down: 'Service disruption', checking: 'Checking…' }[status]

  return (
    <>
      <SEO title="Status" noindex />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-4xl) var(--space-lg)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '32px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-xl)' }}>System status</h1>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: statusColor }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', color: 'var(--color-text-primary)' }}>{statusLabel}</span>
          </div>
          {detail && <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>{detail}</p>}
          {checked && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '12px' }}>Last checked: {format(checked, 'HH:mm:ss')}</p>}
          <button onClick={check} style={{ marginTop: '16px', padding: '8px 16px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Check again
          </button>
        </div>
        <div style={{ marginTop: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[{ name: 'API', sub: import.meta.env.VITE_API_URL }, { name: 'Database', sub: 'Supabase ca-central-1' }, { name: 'Auth', sub: 'Supabase Auth' }].map(c => (
            <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '14px' }}>{c.name}</span>
                {c.sub && <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>{c.sub}</span>}
              </div>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor }} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
