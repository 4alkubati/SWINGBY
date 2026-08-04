import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChatCircle } from '@phosphor-icons/react'
import api from '../../lib/api'
import Spinner from '../../components/Spinner'
import EmptyState from '../../components/EmptyState'
import styles from './Dashboard.module.css'

// Messaging spans the quote → booking arc (CLAUDE.md). Pre-booking chat is live
// on quote/interest threads and is NOT gated behind a confirmed booking.
//
// This page used to call GET /bookings/, filter to confirmed/in_progress/
// completed, and tell the user "Messages are available on confirmed bookings
// only" — which hid every quote-stage conversation from web. A client
// negotiating a quote could see and answer it on mobile and nowhere else.
//
// GET /messages/threads is the endpoint built for this. It returns both
// thread_type "booking" and thread_type "interest" rows, already carrying the
// counterpart name, last message and unread count, so a row needs no second
// round-trip to render.

function timeAgo(iso) {
  if (!iso) return ''
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function preview(t) {
  if (t.last_message_type === 'image') return '📷 Photo'
  if (t.last_message_type === 'terms') return '📄 Agreement'
  return t.last_message || 'No messages yet'
}

export default function Messages() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['messageThreads'],
    queryFn: () => api.get('/messages/threads').then(r => r.data),
    refetchInterval: 15000,
  })

  const threads = Array.isArray(data) ? data : data?.items ?? data?.threads ?? []

  return (
    <div>
      <h1 className={styles.pageTitle}>Messages</h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 'var(--space-sm) 0 var(--space-lg)' }}>
        Quotes and confirmed bookings.
      </p>

      {isLoading ? <Spinner /> : isError ? (
        <EmptyState icon={<ChatCircle size={48} />} title="Could not load messages" description="Try again in a moment." />
      ) : threads.length === 0 ? (
        <EmptyState icon={<ChatCircle size={48} />} title="No messages yet" description="Quotes and bookings you're part of will show up here." />
      ) : (
        <div className={styles.list}>
          {threads.map(t => (
            <Link
              key={`${t.thread_type}-${t.id}`}
              to={t.thread_type === 'interest' ? `/app/messages/quote/${t.id}` : `/app/messages/${t.id}`}
              className={styles.listItem}
            >
              <div style={{ minWidth: 0 }}>
                <div className={styles.listTitle}>
                  {t.counterpart_name || t.title || 'Chat'}
                  {t.thread_type === 'interest' && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--color-accent-text)', background: 'rgba(110,86,247,0.12)', borderRadius: 4, padding: '2px 6px' }}>
                      Quote
                    </span>
                  )}
                </div>
                <div className={styles.listSub} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {preview(t)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {t.unread_count > 0 && (
                  <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: 'var(--color-accent)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                    {t.unread_count}
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{timeAgo(t.last_at)}</span>
                <ChatCircle size={18} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
