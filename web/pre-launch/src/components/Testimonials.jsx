import styles from './Testimonials.module.css'

const TESTIMONIALS = [
  {
    quote: 'Got 4 quotes within 20 minutes. Booked the same day. Insanely easy.',
    name: 'Sarah M.',
    role: 'Calgary',
  },
  {
    quote: "I'm a one-person shop. SwingBy fills my calendar without me lifting a finger.",
    name: 'Ahmed K.',
    role: 'Painter',
  },
  {
    quote: "Cancellation policy is fair to both sides. Finally a marketplace that doesn't screw the worker.",
    name: 'Khalid R.',
    role: 'Cleaner',
  },
]

export default function Testimonials() {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Real users, real stories</h2>
      <div className={styles.track}>
        {TESTIMONIALS.map((t, i) => (
          <div className={styles.card} key={i}>
            <span className={styles.quoteMark} aria-hidden="true">"</span>
            <p className={styles.body}>{t.quote}</p>
            <div className={styles.attribution}>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.sep}>·</span>
              <span className={styles.role}>{t.role}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
