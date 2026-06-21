import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Storefront, Broom, Wrench, Lightning, Tree, PaintBrush, Hammer, Package, Plus, CheckCircle, Clock } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import s from './BusinessOnboarding.module.css'

const SERVICE_CATEGORIES = [
  { key: 'cleaning', icon: Broom },
  { key: 'plumbing', icon: Wrench },
  { key: 'electrical', icon: Lightning },
  { key: 'landscaping', icon: Tree },
  { key: 'painting', icon: PaintBrush },
  { key: 'carpentry', icon: Hammer },
  { key: 'handyman', icon: Package },
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const STEPS = ['welcome', 'info', 'services', 'team', 'schedule', 'payment', 'complete']

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
}

export default function BusinessOnboarding() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)

  const [bizName, setBizName] = useState('')
  const [bizDesc, setBizDesc] = useState('')
  const [bizPhone, setBizPhone] = useState('')
  const [bizAddress, setBizAddress] = useState('')
  const [selectedServices, setSelectedServices] = useState([])
  const [team, setTeam] = useState([{ name: '', role: 'Owner' }])
  const [schedule, setSchedule] = useState(
    DAYS.reduce((acc, day) => ({ ...acc, [day]: { open: '09:00', close: '17:00', closed: day === 'Sunday' } }), {})
  )

  if (loading) return <PageSkeleton />

  function next() { setDir(1); setStep((s) => Math.min(s + 1, STEPS.length - 1)) }
  function back() { setDir(-1); setStep((s) => Math.max(s - 1, 0)) }

  function toggleService(key) {
    setSelectedServices((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  function toggleDay(day) {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], closed: !prev[day].closed } }))
  }

  function updateTime(day, field, val) {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], [field]: val } }))
  }

  function addTeamMember() {
    setTeam((prev) => [...prev, { name: '', role: '' }])
  }

  function updateTeam(idx, field, val) {
    setTeam((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m))
  }

  const isComplete = step === STEPS.length - 1

  return (
    <>
      <SEO title="Business Onboarding — SwingBy" />
      <div className={s.page}>
        <div className={s.card}>
          {!isComplete && (
            <div className={s.progress}>
              {STEPS.slice(0, -1).map((_, i) => (
                <div key={i} className={`${s.dot} ${i < step ? s.dotDone : ''} ${i === step ? s.dotActive : ''}`} />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait" custom={dir}>
            {step === 0 && (
              <motion.div key="welcome" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.stepLabel}>Step 1 of 6</div>
                <h2 className={s.stepTitle}>{t('onboarding.welcomeTitle')}</h2>
                <p className={s.stepSubtitle}>Let's get your business set up on SwingBy. This takes about 5 minutes.</p>
                <div className={s.actions}>
                  <Button variant="primary" size="lg" onClick={next}>{t('common.getStarted')}</Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="info" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.stepLabel}>Step 2 of 6</div>
                <h2 className={s.stepTitle}>Business information</h2>
                <p className={s.stepSubtitle}>Tell us about your business so clients can find you.</p>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Business name</label>
                  <input className={s.fieldInput} value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="e.g. Mike's Plumbing Co." />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Description</label>
                  <textarea className={s.fieldTextarea} value={bizDesc} onChange={(e) => setBizDesc(e.target.value)} placeholder="What does your business do?" rows={3} />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Phone number</label>
                  <input className={s.fieldInput} value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} placeholder="+1 (403) 555-0123" />
                </div>
                <div className={s.fieldGroup}>
                  <label className={s.fieldLabel}>Business address</label>
                  <input className={s.fieldInput} value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} placeholder="123 Main St, Calgary, AB" />
                </div>
                <div className={s.actions}>
                  <Button variant="secondary" onClick={back}>{t('common.back')}</Button>
                  <Button variant="primary" onClick={next}>{t('common.next')}</Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="services" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.stepLabel}>Step 3 of 6</div>
                <h2 className={s.stepTitle}>Services offered</h2>
                <p className={s.stepSubtitle}>Select the categories that best describe your services.</p>
                <div className={s.categoryGrid}>
                  {SERVICE_CATEGORIES.map(({ key, icon: Icon }) => (
                    <button key={key} className={`${s.chip} ${selectedServices.includes(key) ? s.chipSelected : ''}`} onClick={() => toggleService(key)}>
                      <Icon size={18} weight={selectedServices.includes(key) ? 'bold' : 'regular'} />
                      {t(`categories.${key}`)}
                    </button>
                  ))}
                </div>
                <div className={s.actions}>
                  <Button variant="secondary" onClick={back}>{t('common.back')}</Button>
                  <Button variant="primary" onClick={next}>{t('common.next')}</Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="team" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.stepLabel}>Step 4 of 6</div>
                <h2 className={s.stepTitle}>Your team</h2>
                <p className={s.stepSubtitle}>Add team members who will be fulfilling jobs.</p>
                {team.map((member, i) => (
                  <div key={i} className={s.teamRow}>
                    <div className={s.teamAvatar}>{(member.name?.[0] || String(i + 1)).toUpperCase()}</div>
                    <div className={s.teamInfo}>
                      <input className={s.fieldInput} style={{ marginBottom: 'var(--space-xs)' }} value={member.name} onChange={(e) => updateTeam(i, 'name', e.target.value)} placeholder="Full name" />
                      <input className={s.fieldInput} value={member.role} onChange={(e) => updateTeam(i, 'role', e.target.value)} placeholder="Role (e.g. Technician)" />
                    </div>
                  </div>
                ))}
                <button className={s.addBtn} onClick={addTeamMember}>
                  <Plus size={16} /> Add team member
                </button>
                <div className={s.actions}>
                  <Button variant="secondary" onClick={back}>{t('common.back')}</Button>
                  <Button variant="primary" onClick={next}>{t('common.next')}</Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="schedule" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.stepLabel}>Step 5 of 6</div>
                <h2 className={s.stepTitle}>Business hours</h2>
                <p className={s.stepSubtitle}>Set your availability so clients know when to book.</p>
                {DAYS.map((day) => (
                  <div key={day} className={s.dayRow}>
                    <span className={s.dayName}>{day.slice(0, 3)}</span>
                    {schedule[day].closed ? (
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Closed</span>
                    ) : (
                      <div className={s.timeInputs}>
                        <input className={s.timeInput} type="time" value={schedule[day].open} onChange={(e) => updateTime(day, 'open', e.target.value)} />
                        <span className={s.dash}>—</span>
                        <input className={s.timeInput} type="time" value={schedule[day].close} onChange={(e) => updateTime(day, 'close', e.target.value)} />
                      </div>
                    )}
                    <button className={`${s.chip}`} style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: '12px' }} onClick={() => toggleDay(day)}>
                      {schedule[day].closed ? 'Open' : 'Close'}
                    </button>
                  </div>
                ))}
                <div className={s.actions}>
                  <Button variant="secondary" onClick={back}>{t('common.back')}</Button>
                  <Button variant="primary" onClick={next}>{t('common.next')}</Button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="payment" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.stepLabel}>Step 6 of 6</div>
                <h2 className={s.stepTitle}>Payment setup</h2>
                <p className={s.stepSubtitle}>Connect your payment method to receive earnings from completed jobs.</p>
                <div style={{ padding: 'var(--space-xl)', textAlign: 'center', background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-xl)' }}>
                  <Clock size={32} weight="regular" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }} />
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>You can add a payout method any time from your dashboard. Skip for now and finish your profile — you'll be paid the moment a job completes.</p>
                </div>
                <div className={s.actions}>
                  <Button variant="secondary" onClick={back}>{t('common.back')}</Button>
                  <Button variant="primary" onClick={next}>Finish setup</Button>
                </div>
              </motion.div>
            )}

            {isComplete && (
              <motion.div key="complete" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.completeIcon}>
                  <CheckCircle size={40} weight="bold" />
                </div>
                <h2 className={s.completeTitle}>{t('onboarding.complete')}</h2>
                <p className={s.completeDesc}>
                  {bizName ? `${bizName} is` : 'Your business is'} ready to start receiving job requests on SwingBy.
                </p>
                <div className={s.completeCtas}>
                  <Button variant="primary" size="lg" onClick={() => navigate('/business/dashboard')}>Go to Dashboard</Button>
                  <Button variant="secondary" size="lg" onClick={() => navigate('/business/services')}>Manage Services</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
