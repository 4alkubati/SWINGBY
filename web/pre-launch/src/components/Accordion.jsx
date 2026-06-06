import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CaretDown } from '@phosphor-icons/react'
import styles from './Accordion.module.css'

export function AccordionItem({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={styles.item}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className={styles.triggerText}>{title}</span>
        <CaretDown
          size={16}
          weight="bold"
          className={`${styles.caret} ${open ? styles.caretOpen : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.content}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          >
            <div className={styles.inner}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Accordion({ items, className }) {
  return (
    <div className={`${styles.accordion} ${className || ''}`}>
      {items.map((item, i) => (
        <AccordionItem key={i} title={item.title}>
          {item.content}
        </AccordionItem>
      ))}
    </div>
  )
}
