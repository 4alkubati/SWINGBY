import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Broom, Wrench, Lightning, Tree, PaintBrush, Hammer, Package, Bell, EnvelopeSimple, CheckCircle } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import s from './ClientOnboarding.module.css'

const CATEGORIES = [
  { key: 'cleaning', icon: Broom },
  { key: 'plumbing', icon: Wrench },
  { key: 'electrical', icon: Lightning },
  { key: 'landscaping', icon: Tree },
  { key: 'painting', icon: PaintBrush },
  { key: 'carpentry', icon: Hammer },
  { key: 'handyman', icon: Package },
]

const STEPS = ['welcome', 'location', 'interests', 'notifications']

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
}

export default function ClientOnboarding() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [city, setCity] = useState('Calgary')
  const [selectedCats, setSelectedCats] = useState([])
  const [notifs, setNotifs] = useState({ push: true, email: true, sms: false })

  if (loading) return <PageSkeleton />

  function next() {
    setDir(1)
    if (step < STEPS.length - 1) setStep(step + 1)
    else finish()
  }

  function back() {
    setDir(-1)
    if (step > 0) setStep(step - 1)
  }

  function toggleCat(key) {
    setSelectedCats((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  function toggleNotif(key) {
    setNotifs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function finish() {
    setDir(1)
    setStep(STEPS.length)
  }

  const isComplete = step === STEPS.length

  return (
    <>
      <SEO title={t('onboarding.welcomeTitle')} />
      <div className={s.page}>
        <div className={s.card}>
          {!isComplete && (
            <div className={s.progress}>
              {STEPS.map((_, i) => (
                <div key={i} className={`${s.dot} ${i < step ? s.dotDone : ''} ${i === step ? s.dotActive : ''}`} />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait" custom={dir}>
            {step === 0 && (
              <motion.div key="welcome" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <h2 className={s.stepTitle}>{t('onboarding.welcomeTitle')}</h2>
                <p className={s.stepSubtitle}>{t('onboarding.welcomeSubtitle')}</p>
                <div className={s.actions}>
                  <Button variant="primary" size="lg" onClick={next}>{t('common.next')}</Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="location" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <h2 className={s.stepTitle}>{t('onboarding.locationTitle')}</h2>
                <p className={s.stepSubtitle}>{t('onboarding.locationSubtitle')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                  <MapPin size={20} weight="bold" style={{ color: 'var(--color-accent-text)' }} />
                  <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{t('onboarding.locationTitle')}</span>
                </div>
                <input className={s.locationInput} type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter your city" />
                <div className={s.actions}>
                  <Button variant="secondary" onClick={back}>{t('common.back')}</Button>
                  <Button variant="primary" onClick={next}>{t('common.next')}</Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="interests" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <h2 className={s.stepTitle}>{t('onboarding.interestsTitle')}</h2>
                <p className={s.stepSubtitle}>{t('onboarding.interestsSubtitle')}</p>
                <div className={s.categoryGrid}>
                  {CATEGORIES.map(({ key, icon: Icon }) => (
                    <button key={key} className={`${s.categoryChip} ${selectedCats.includes(key) ? s.chipSelected : ''}`} onClick={() => toggleCat(key)}>
                      <Icon size={18} weight={selectedCats.includes(key) ? 'bold' : 'regular'} />
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
              <motion.div key="notifications" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <h2 className={s.stepTitle}>{t('onboarding.notificationsTitle')}</h2>
                <p className={s.stepSubtitle}>{t('onboarding.notificationsSubtitle')}</p>
                {[
                  { key: 'push', label: 'Push notifications', desc: 'Get instant updates on your device' },
                  { key: 'email', label: 'Email notifications', desc: 'Receive booking confirmations and updates' },
                  { key: 'sms', label: 'SMS notifications', desc: 'Text alerts for urgent updates' },
                ].map((opt) => (
                  <div key={opt.key} className={s.notifOption}>
                    <div>
                      <div className={s.notifLabel}>{opt.label}</div>
                      <div className={s.notifDesc}>{opt.desc}</div>
                    </div>
                    <button className={`${s.toggle} ${notifs[opt.key] ? s.toggleOn : ''}`} onClick={() => toggleNotif(opt.key)} aria-label={`Toggle ${opt.label}`}>
                      <div className={s.toggleKnob} />
                    </button>
                  </div>
                ))}
                <div className={s.actions}>
                  <Button variant="secondary" onClick={back}>{t('common.back')}</Button>
                  <Button variant="primary" onClick={finish}>{t('common.next')}</Button>
                </div>
              </motion.div>
            )}

            {isComplete && (
              <motion.div key="complete" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.completeIcon}>
                  <CheckCircle size={36} weight="bold" />
                </div>
                <h2 className={s.completeTitle}>{t('onboarding.complete')}</h2>
                <p className={s.completeDesc}>
                  Your preferences have been saved. You're ready to start exploring services in {city}.
                </p>
                <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={() => navigate('/dashboard')}>
                  {t('dashboard.welcome', { name: '' }).replace(', ', '')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
