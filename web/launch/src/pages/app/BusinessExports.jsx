import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { DownloadSimple, FileCsv, FileXls, CheckCircle } from '@phosphor-icons/react'
import ExcelJS from 'exceljs'
import api from '../../lib/api'
import Button from '../../components/Button'
import Spinner from '../../components/Spinner'
import Alert from '../../components/Alert'
import styles from './Dashboard.module.css'

function safeDate(str) {
  try { return str ? format(parseISO(str), 'yyyy-MM-dd') : '' }
  catch { return '' }
}

function bookingsToRows(bookings) {
  return bookings.map(b => ({
    'Booking ID': b.id,
    'Status': b.status,
    'Total Amount': b.total_amount || 0,
    'Net Earnings': ((b.total_amount || 0) * 0.9).toFixed(2),
    'Client ID': b.client_id || '',
    'Employee ID': b.employee_id || '',
    'Payment Status': b.payment_status || '',
    'Created': safeDate(b.created_at),
    'Updated': safeDate(b.updated_at),
  }))
}

function downloadCSV(rows, filename) {
  const headers = Object.keys(rows[0] || {})
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const v = String(row[h] ?? '')
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
    }).join(','))
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadXLSX(rows, sheetName, filename) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)
  if (rows.length > 0) {
    ws.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k, width: Math.max(k.length + 4, 16) }))
    rows.forEach(row => ws.addRow(row))
    ws.getRow(1).font = { bold: true }
  }
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const EXPORT_CONFIGS = [
  {
    id: 'bookings-csv',
    label: 'Bookings — CSV',
    description: 'All booking records with status, amounts, and dates.',
    icon: FileCsv,
    format: 'CSV',
  },
  {
    id: 'bookings-xlsx',
    label: 'Bookings — Excel',
    description: 'Same data as CSV, formatted for Excel with column widths.',
    icon: FileXls,
    format: 'XLSX',
  },
  {
    id: 'earnings-csv',
    label: 'Earnings — CSV',
    description: 'Completed bookings with gross revenue, fee, and net earnings.',
    icon: FileCsv,
    format: 'CSV',
  },
  {
    id: 'earnings-xlsx',
    label: 'Earnings — Excel',
    description: 'Earnings data as a spreadsheet with sum totals.',
    icon: FileXls,
    format: 'XLSX',
  },
]

export default function BusinessExports() {
  const [done, setDone] = useState({})
  const [loading, setLoading] = useState({})

  const { data: bookings = [], isLoading, isError } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings/').then(r => r.data),
  })

  const { data: biz } = useQuery({
    queryKey: ['myBusiness'],
    queryFn: () => api.get('/businesses/me').then(r => r.data),
  })

  const slug = (biz?.business_name || 'swingby').replace(/\s+/g, '-').toLowerCase()
  const ts = format(new Date(), 'yyyy-MM-dd')

  async function handleExport(id) {
    setLoading(prev => ({ ...prev, [id]: true }))
    try {
      const rows = bookingsToRows(bookings)
      const completedRows = bookingsToRows(bookings.filter(b => b.status === 'completed'))

      if (id === 'bookings-csv') downloadCSV(rows, `${slug}-bookings-${ts}.csv`)
      if (id === 'bookings-xlsx') await downloadXLSX(rows, 'Bookings', `${slug}-bookings-${ts}.xlsx`)
      if (id === 'earnings-csv') downloadCSV(completedRows, `${slug}-earnings-${ts}.csv`)
      if (id === 'earnings-xlsx') {
        const total = completedRows.reduce((s, r) => s + Number(r['Total Amount'] || 0), 0)
        const netTotal = completedRows.reduce((s, r) => s + Number(r['Net Earnings'] || 0), 0)
        const withTotals = [...completedRows, { 'Booking ID': 'TOTAL', 'Total Amount': total.toFixed(2), 'Net Earnings': netTotal.toFixed(2) }]
        await downloadXLSX(withTotals, 'Earnings', `${slug}-earnings-${ts}.xlsx`)
      }
      setDone(prev => ({ ...prev, [id]: true }))
      setTimeout(() => setDone(prev => ({ ...prev, [id]: false })), 3000)
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  if (isLoading) return <Spinner />
  if (isError) return <Alert type="error" message="Could not load data for export." />

  return (
    <div style={{ maxWidth: '680px' }}>
      <h1 className={styles.pageTitle}>Export data</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 'var(--space-sm) 0 var(--space-xl)' }}>
        Download your booking and earnings data. Files are generated locally — nothing is sent to a third party.
      </p>

      {bookings.length === 0 && (
        <Alert type="info" message="No booking data yet. Exports will be available once you have bookings." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {EXPORT_CONFIGS.map(({ id, label, description, icon: Icon, format: fmt }) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-lg)', padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div style={{ width: 44, height: 44, background: 'var(--color-accent-muted)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={22} style={{ color: 'var(--color-accent-text)' }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{description}</div>
              </div>
            </div>
            <Button
              variant={done[id] ? 'secondary' : 'primary'}
              size="sm"
              icon={done[id] ? <CheckCircle size={15} /> : <DownloadSimple size={15} />}
              loading={loading[id]}
              disabled={bookings.length === 0}
              onClick={() => handleExport(id)}
            >
              {done[id] ? 'Downloaded' : fmt}
            </Button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>Export summary</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '8px 16px', fontSize: '13px' }}>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Total bookings</dt>
          <dd style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{bookings.length}</dd>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Completed bookings</dt>
          <dd style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{bookings.filter(b => b.status === 'completed').length}</dd>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Gross revenue</dt>
          <dd style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            ${bookings.filter(b => b.status === 'completed').reduce((s, b) => s + (b.total_amount || 0), 0).toFixed(2)}
          </dd>
        </dl>
      </div>
    </div>
  )
}
