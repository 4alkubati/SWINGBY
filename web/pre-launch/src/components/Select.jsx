import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CaretDown, Check } from '@phosphor-icons/react'
import styles from './Select.module.css'

export default function Select({ label, value, onChange, options = [], placeholder, error, className }) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(-1)
  const ref = useRef(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault()
      setOpen(true)
      setFocused(0)
      return
    }
    if (!open) return

    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused((i) => Math.min(i + 1, options.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocused((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && focused >= 0) {
      onChange(options[focused].value)
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className={`${styles.wrapper} ${error ? styles.error : ''} ${className || ''}`}>
      {label && <span className={styles.label}>{label}</span>}
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? styles.value : styles.placeholder}>
          {selected?.label || placeholder || 'Select...'}
        </span>
        <CaretDown size={16} className={`${styles.caret} ${open ? styles.caretOpen : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            className={styles.panel}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            role="listbox"
          >
            {options.map((opt, i) => (
              <li
                key={opt.value}
                className={`${styles.option} ${i === focused ? styles.focused : ''} ${opt.value === value ? styles.selected : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                onMouseEnter={() => setFocused(i)}
                role="option"
                aria-selected={opt.value === value}
              >
                {opt.label}
                {opt.value === value && <Check size={14} weight="bold" />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {error && <span className={styles.helper}>{error}</span>}
    </div>
  )
}
