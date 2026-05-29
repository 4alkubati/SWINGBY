import { useEffect, useState } from 'react'
import api from '@/services/api'

const LICENSE_BADGE = {
  verified:   'badge-green',
  pending:    'badge-orange',
  rejected:   'badge-red',
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    api.get('/admin/businesses')
      .then((res) => setBusinesses(Array.isArray(res.data) ? res.data : res.data?.businesses ?? []))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load businesses'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="page-header">
        <h1>Businesses</h1>
        <p>All registered businesses on the platform.</p>
      </div>

      <div className="table-wrapper">
        <div className="table-toolbar">
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>Businesses</strong>
            {!loading && <span className="count">{businesses.length} total</span>}
          </span>
        </div>

        {loading && <div className="state-loading">Loading businesses…</div>}
        {error   && <div className="state-empty" style={{ color: 'var(--red)' }}>{error}</div>}

        {!loading && !error && businesses.length === 0 && (
          <div className="state-empty">No businesses found.</div>
        )}

        {!loading && !error && businesses.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Category</th>
                <th>License Status</th>
                <th>Avg Rating</th>
                <th>Jobs Done</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((biz) => {
                const licenseKey = biz.license_status?.toLowerCase() || 'pending'
                return (
                  <tr key={biz.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {biz.name}
                    </td>
                    <td>{biz.owner_name || biz.owner?.name || '—'}</td>
                    <td>{biz.category || '—'}</td>
                    <td>
                      <span className={`badge ${LICENSE_BADGE[licenseKey] || 'badge-muted'}`}>
                        {biz.license_status || 'pending'}
                      </span>
                    </td>
                    <td>
                      {biz.avg_rating != null
                        ? <span style={{ color: 'var(--orange)' }}>★ {Number(biz.avg_rating).toFixed(1)}</span>
                        : '—'}
                    </td>
                    <td>{biz.jobs_completed ?? biz.total_jobs ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
