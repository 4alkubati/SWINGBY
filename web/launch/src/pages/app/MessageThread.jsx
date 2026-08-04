import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import api from '../../lib/api'
import { useUser } from '../../hooks/useUser'
import Spinner from '../../components/Spinner'
import styles from './Dashboard.module.css'

// Serves BOTH thread kinds, because messaging spans the quote → booking arc:
//
//   /app/messages/:bookingId       booking thread  → GET /messages/{booking_id}
//   /app/messages/quote/:interestId quote thread   → GET /messages/interest/{id}
//
// Sends key off the matching field — POST /messages/ takes exactly one of
// booking_id or interest_id (MessageSend in backend/app/api/messages.py). This
// component previously knew only about bookingId, so a quote-stage thread had
// no way to be read or answered on web at all.
export default function MessageThread() {
  const { bookingId, interestId } = useParams()
  const isQuote = Boolean(interestId)
  const threadId = isQuote ? interestId : bookingId
  const { data: user } = useUser()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  const path = isQuote ? `/messages/interest/${interestId}` : `/messages/${bookingId}`

  const { data, isLoading } = useQuery({
    queryKey: ['messages', isQuote ? 'interest' : 'booking', threadId],
    queryFn: () => api.get(path).then(r => r.data),
    refetchInterval: 5000,
  })

  // Booking threads return a bare array; the interest endpoint paginates.
  const messages = Array.isArray(data) ? data : data?.items ?? data?.messages ?? []

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = useMutation({
    mutationFn: (content) => api.post('/messages/', (
      isQuote ? { interest_id: interestId, content } : { booking_id: bookingId, content }
    )),
    onSuccess: () => {
      qc.invalidateQueries(['messages', isQuote ? 'interest' : 'booking', threadId])
      qc.invalidateQueries(['messageThreads'])
      setText('')
    },
  })

  function handleSend(e) {
    e.preventDefault()
    if (!text.trim()) return
    send.mutate(text.trim())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      <h1 className={styles.pageTitle} style={{ marginBottom: 'var(--space-md)' }}>
        {isQuote ? 'Quote conversation' : 'Messages'}
      </h1>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: 'var(--space-md)' }}>
        {isLoading ? <Spinner /> : messages.map(m => {
          const isMe = m.sender_id === user?.id
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '70%', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: isMe ? 'var(--color-accent-muted)' : 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                {m.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', padding: 'var(--space-md)', borderTop: '1px solid var(--color-border)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message…"
          style={{ flex: 1, padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-primary)', fontSize: '14px' }}
        />
        <button type="submit" disabled={!text.trim() || send.isPending} style={{ padding: '10px 16px', background: 'var(--color-accent-btn)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PaperPlaneTilt size={18} weight="fill" />
        </button>
      </form>
    </div>
  )
}
