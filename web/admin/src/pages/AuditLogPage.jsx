import { useEffect, useState } from 'react'
import api from '@/services/api'

// Placeholder rows shown when the endpoint doesn't exist yet
const PLACEHOLDER_ROWS = [
  { id: 1, timestamp: '2026-05-27T09:14:00Z', actor: 'admin@swingby.com', action: 'suspend_user',      resource_type: 'user',     resource_id: 'usr_001' },
  { id: 2, timestamp: '2026-05-27T08:55:00Z', actor: 'admin@swingby.com', action: 'verify_license',    resource_type: 'business', resource_id: 'biz_012' },
  { id: 3, timestamp: '2026-05-26T17:40:00Z', actor: 'system',            action: 'booking_completed', resource_type: 'booking',  resource_id: 'bkg_089' },
  { id: 4, timestamp: '2026-05-26T15:22:00Z', actor: 'admin@swingby.com', action: 'unsuspend_user',    resource_type: 'user',     resource_id: 'usr_047' },
  { id: 5, timestamp: '2026-05-26T12:01:00Z', actor: 'system',            action: 'payment_released',  resource_type: 'booking',  resource_id: 'bkg_074' },
]

function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ts
  }
}

export default function AuditLogPage() {
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [isPlaceholder, setIsPlaceholder] = useState(false)

  useEffect(() => {
    api.get('/admin/audit-log')
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data?.logs ?? []
        setEntries(data)
      })
      .catch(() => {
        // Endpoint not yet implemented — show placeholder rows
        setEntries(PLACEHOLDER_ROWS)
        setIsPlaceholder(true)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="page-header">
        <h1>Audit Log</h1>
        <p>
          Admin actions and system events.
          {isPlaceholder && (
            <span style={{ color: 'var(--orange)', marginLeft: 8, fontSize: 12 }}>
              (placeholder — /admin/audit-log not yet live)
            </span>
          )}
        </p>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>Events</strong>
            {!loading && <span className="count">{entries.length} entries</span>}
          </span>
        </div>

        {loading && <div className="state-loading">Loading audit log…</div>}

        {!loading && entries.length === 0 && (
          <div className="state-empty">No audit log entries found.</div>
        )}

        {!loading && entries.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource Type</th>
                <th>Resource ID</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.id ?? idx}>
                  <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                    {formatTimestamp(entry.timestamp || entry.created_at)}
                  </td>
                  <td>{entry.actor || entry.admin_email || '—'}</td>
                  <td>
                    <span className="badge badge-orange">
                      {entry.action || entry.event_type || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-muted">
                      {entry.resource_type || entry.entity_type || '—'}
                    </span>
                  </td>
                  <td className="mono">{entry.resource_id || entry.entity_id || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
