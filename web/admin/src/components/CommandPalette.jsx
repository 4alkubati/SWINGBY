import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  House,
  Users,
  Buildings,
  CalendarCheck,
  ClockCounterClockwise,
  SignOut,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { logout } from '@/services/auth'
import styles from './CommandPalette.module.css'

const NAV_ITEMS = [
  { id: 'nav-dashboard',   label: 'Dashboard',   category: 'Navigation',     Icon: House,                  type: 'navigate', to: '/' },
  { id: 'nav-users',       label: 'Users',        category: 'Navigation',     Icon: Users,                  type: 'navigate', to: '/users' },
  { id: 'nav-businesses',  label: 'Businesses',   category: 'Navigation',     Icon: Buildings,              type: 'navigate', to: '/businesses' },
  { id: 'nav-bookings',    label: 'Bookings',     category: 'Navigation',     Icon: CalendarCheck,          type: 'navigate', to: '/bookings' },
  { id: 'nav-audit-log',   label: 'Audit Log',    category: 'Navigation',     Icon: ClockCounterClockwise,  type: 'navigate', to: '/audit-log' },
  { id: 'action-signout',  label: 'Sign out',     category: 'Quick Actions',  Icon: SignOut,                type: 'action' },
]

function fuzzyMatch(query, label) {
  if (!query) return true
  const q = query.toLowerCase()
  const l = label.toLowerCase()
  let qi = 0
  for (let i = 0; i < l.length && qi < q.length; i++) {
    if (l[i] === q[qi]) qi++
  }
  return qi === q.length
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const filtered = NAV_ITEMS.filter(item => fuzzyMatch(query, item.label))

  // Group results by category in order
  const categories = []
  const seen = new Set()
  filtered.forEach(item => {
    if (!seen.has(item.category)) {
      seen.add(item.category)
      categories.push(item.category)
    }
  })

  // Clamp selectedIndex when filtered list changes
  useEffect(() => {
    setSelectedIndex(prev => Math.min(prev, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  // Reset state when palette opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      // Body scroll lock
      document.body.style.overflow = 'hidden'
      // Auto-focus handled by autoFocus prop but we also do it manually
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const executeItem = useCallback((item) => {
    if (!item) return
    onClose()
    if (item.type === 'navigate') {
      navigate(item.to)
    } else if (item.id === 'action-signout') {
      logout()
      navigate('/login')
    }
  }, [navigate, onClose])

  const handleKeyDown = useCallback((e) => {
    if (!open) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        executeItem(filtered[selectedIndex])
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      default:
        break
    }
  }, [open, filtered, selectedIndex, executeItem, onClose])

  // Global Cmd+K / Ctrl+K listener is handled in App.jsx
  // Local keydown for arrow/enter/esc inside the modal
  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  // Build a flat list with category header metadata
  let flatList = []
  categories.forEach(cat => {
    const items = filtered.filter(i => i.category === cat)
    flatList.push({ type: 'header', label: cat, key: `header-${cat}` })
    items.forEach(item => flatList.push({ type: 'item', item }))
  })

  let itemCounter = -1

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="presentation"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
      >
        {/* Search input row */}
        <div className={styles.inputRow}>
          <span className={styles.searchIcon} aria-hidden="true">
            <MagnifyingGlass size={18} />
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            autoFocus
            aria-label="Search commands"
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className={styles.escBadge}>Esc</kbd>
        </div>

        {/* Results */}
        <div className={styles.results} ref={listRef} role="listbox" aria-label="Results">
          {filtered.length === 0 ? (
            <div className={styles.empty}>No results for &ldquo;{query}&rdquo;</div>
          ) : (
            flatList.map(entry => {
              if (entry.type === 'header') {
                return (
                  <div key={entry.key} className={styles.categoryHeader}>
                    {entry.label}
                  </div>
                )
              }
              itemCounter++
              const idx = itemCounter
              const { item } = entry
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  className={`${styles.resultItem}${isSelected ? ` ${styles.selected}` : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  data-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => executeItem(item)}
                  tabIndex={-1}
                >
                  <span className={styles.itemIcon} aria-hidden="true">
                    <item.Icon size={18} />
                  </span>
                  <span className={styles.itemLabel}>{item.label}</span>
                  <span className={styles.categoryTag}>{item.category}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
