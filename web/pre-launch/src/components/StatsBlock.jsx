import { useEffect, useRef, useState } from 'react'
import styles from './StatsBlock.module.css'

function CountUp({ end, duration = 2000, prefix = '', suffix = '' }) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true) },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const start = performance.now()
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * end))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, end, duration])

  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>
}

export default function StatsBlock({ stats, className }) {
  return (
    <div className={`${styles.grid} ${className || ''}`}>
      {stats.map((stat, i) => (
        <div key={i} className={styles.stat}>
          <div className={styles.number}>
            <CountUp end={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
          </div>
          <div className={styles.label}>{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
