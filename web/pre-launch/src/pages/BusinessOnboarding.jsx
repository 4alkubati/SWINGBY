import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Storefront, Broom, Wrench, Lightning, Tree, PaintBrush, Hammer, Package, Plus, CheckCircle, Clock, WarningCircle } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageSkeleton from '../components/PageSkeleton'
import s from './BusinessOnboarding.module.css'

const API_BASE = import.meta.env.VITE_API_URL || 'https://swingbyy-api.onrender.com'

// F110 fix (2026-08-11): this wizard used to be pure useState — six steps of
// input discarded on navigation, ending in a completion screen that claimed
// the business was "ready to start receiving job requests" when nothing had
// ever been sent to the backend. `POST /businesses/` is real (businesses.py)
// and the created row shows up in geo-browse immediately regardless of
// `license_status`, so that claim is made true by actually calling it here.
//
// Team (step 4) and schedule (step 5) do NOT have a real backend counterpart:
// `POST /employees/` requires email + password + full name (an actual login),
// which this step never collects, and there is no `business_hours` table.
// Rather than silently drop that input while still implying it was saved,
// those two steps say plainly that they're for planning only.
async function createBusiness({ bizName, bizDesc, bizAddress, bizPhone, category }) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Your session expired — please log in again.')

  const res = await fetch(`${API_BASE}/businesses/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      business_name: bizName.trim(),
      category,
      description: bizDesc.trim() || undefined,
      address: bizAddress.trim() || undefined,
    }),
  })

  if (!res.ok) {
    let detail = 'Could not save your business. Please try again.'
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch { /* ignore json parse failures */ }
    // "You already have a business registered" is not a failure from the
    // user's point of view — it means this claim is already true.
    if (res.status === 400 && /already have a business/i.test(detail)) {
      await saveOwnerPhone(token, bizPhone)
      return { alreadyExists: true }
    }
    throw new Error(detail)
  }
  await saveOwnerPhone(token, bizPhone)
  return res.json()
}

// The phone number this form collects had nowhere to go: `businesses` has no
// phone column and BusinessCreate has no phone field, so it was typed in and
// dropped on the floor. It belongs on the OWNER's user row, which does have
// one, and PATCH /auth/me accepts it (auth.py::ProfileUpdate).
//
// Called only once the business is known to exist — saving a contact number
// for a business that failed to create would be worse than not saving it.
// Non-fatal on its own: the business is what the wizard promises, and failing
// the whole flow over a secondary detail would lose the real work. The error is
// logged, not swallowed silently.
async function saveOwnerPhone(token, bizPhone) {
  if (!bizPhone?.trim()) return
  try {
    await fetch(`${API_BASE}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ phone: bizPhone.trim() }),
    })
  } catch (e) {
    console.error('Could not save the contact phone number', e)
  }
}

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
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  if (loading) return <PageSkeleton />

  function next() { setDir(1); setStep((s) => Math.min(s + 1, STEPS.length - 1)) }
  function back() { setDir(-1); setStep((s) => Math.max(s - 1, 0)) }

  async function finish() {
    setSubmitError('')
    setSubmitting(true)
    try {
      await createBusiness({
        bizName,
        bizDesc,
        bizAddress,
        bizPhone,
        category: t(`categories.${selectedServices[0]}`),
      })
      setDir(1)
      setStep(STEPS.length - 1)
    } catch (err) {
      setSubmitError(err.message || 'Could not save your business. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // SINGLE select, deliberately. This was a multi-select, but only
  // `selectedServices[0]` was ever sent — a business that picked three got one,
  // silently. `businesses.category` is a single column and BusinessCreate takes
  // a single `category` string (backend/app/api/businesses.py), so there is
  // nowhere for the others to go.
  //
  // Offering one choice is the honest fix: the alternative — keep the grid and
  // caption it "only the first is saved" — is a worse question to ask someone.
  // If multi-category is wanted, it needs a schema change first, not a UI one.
  function toggleService(key) {
    setSelectedServices((prev) => (prev[0] === key ? [] : [key]))
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
                  <Button variant="primary" onClick={next} disabled={!bizName.trim()} title={!bizName.trim() ? 'Enter a business name to continue' : undefined}>{t('common.next')}</Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="services" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.stepLabel}>Step 3 of 6</div>
                <h2 className={s.stepTitle}>Services offered</h2>
                <p className={s.stepSubtitle}>Select the category that best describes your services.</p>
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
                  <Button variant="primary" onClick={next} disabled={selectedServices.length === 0} title={selectedServices.length === 0 ? 'Select a category to continue' : undefined}>{t('common.next')}</Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="team" custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <div className={s.stepLabel}>Step 4 of 6</div>
                <h2 className={s.stepTitle}>Your team</h2>
                <p className={s.stepSubtitle}>For your own planning — team accounts aren't part of setup yet, so this list isn't saved.</p>
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
                <p className={s.stepSubtitle}>For your own planning — hours aren't synced to booking yet, so this isn't saved.</p>
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
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>You can add a payout method any time from your dashboard. Skip for now and finish your profile — you're paid out once a completed job is approved.</p>
                </div>
                {submitError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)', color: 'var(--color-danger)', fontSize: '13px' }}>
                    <WarningCircle size={16} weight="bold" />
                    {submitError}
                  </div>
                )}
                <div className={s.actions}>
                  <Button variant="secondary" onClick={back} disabled={submitting}>{t('common.back')}</Button>
                  <Button variant="primary" onClick={finish} loading={submitting}>Finish setup</Button>
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
