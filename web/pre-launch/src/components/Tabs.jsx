import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import styles from './Tabs.module.css'

export default function Tabs({ tabs, activeTab, onChange, className }) {
  const [indicatorStyle, setIndicatorStyle] = useState({})
  const tabsRef = useRef([])

  useEffect(() => {
    const idx = tabs.findIndex((t) => t.key === activeTab)
    const el = tabsRef.current[idx]
    if (el) {
      setIndicatorStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
      })
    }
  }, [activeTab, tabs])

  return (
    <div className={`${styles.tabs} ${className || ''}`} role="tablist">
      {tabs.map((tab, i) => (
        <button
          key={tab.key}
          ref={(el) => (tabsRef.current[i] = el)}
          className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
          onClick={() => onChange(tab.key)}
          role="tab"
          aria-selected={activeTab === tab.key}
        >
          {tab.label}
        </button>
      ))}
      <motion.div
        className={styles.indicator}
        animate={indicatorStyle}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      />
    </div>
  )
}
