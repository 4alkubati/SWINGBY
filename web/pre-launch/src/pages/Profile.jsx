import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Camera, PencilSimple } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import Avatar from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }
const API_BASE = import.meta.env.VITE_API_URL || 'https://swingbyy-api.onrender.com'

// F137 fix (2026-08-11): four buttons here — Edit Profile, the avatar camera
// button, Add (phone), Edit (location) — used to render with no `onClick` at
// all. That's the exact anti-pattern AccountSettings.jsx's header names:
// "a button here that renders enabled and does nothing is worse than no
// button." Same rule applied here, decided per-button against what
// `PATCH /auth/me` actually accepts (auth.py:229-233 — first_name, last_name,
// phone, avatar_url only; nothing else):
//   * avatar   — real: POST /uploads/image, then PATCH /auth/me{avatar_url}.
//   * name     — real: PATCH /auth/me{first_name,last_name}. "Edit Profile"
//                edits the header name — email is Supabase-managed and has
//                no edit control anywhere on this surface, same as
//                AccountSettings.
//   * phone    — real: PATCH /auth/me{phone}.
//   * location — NOT wireable. `users` has no address/city/lat/lng column at
//                all (docs/swingby_database_schema.md §1) — there is nothing
//                for this to call. Disabled + "Coming soon", the same
//                treatment AccountSettings gives email/language/2FA.
//
// ⚠ name/phone use `window.prompt`, and that IS a new pattern here — it appears
// nowhere else in web/pre-launch, and AccountSettings does NOT use it (an
// earlier version of this comment claimed it did; that was wrong).
//
// It is deliberate but provisional. The endpoints are real, so disabling these
// would hide working functionality, and the alternative — a modal — means
// introducing form/dialog infrastructure this surface does not have, for two
// fields on an authenticated page of a pre-launch site. A native prompt is
// honest (it does what it says) but visually crude on a polished marketing
// site, especially on mobile.
//
// If this page gains any real form UI, replace both call sites first.
async function patchMe(fields) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Your session expired — please log in again.')

  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    let detail = 'Could not save changes. Please try again.'
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch { /* ignore json parse failures */ }
    throw new Error(detail)
  }
  return res.json()
}

export default function Profile() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const fileInputRef = useRef(null)
  const [overrides, setOverrides] = useState({})
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)

  if (loading) return <PageSkeleton />

  const meta = user?.user_metadata || {}
  const firstName = overrides.first_name ?? meta.first_name
  const lastName = overrides.last_name ?? meta.last_name
  const fullName = firstName ? `${firstName} ${lastName || ''}`.trim() : user?.email
  const phone = overrides.phone ?? meta.phone
  const avatarUrl = overrides.avatar_url ?? meta.avatar_url

  async function handleEditName() {
    const input = window.prompt('Enter your full name', fullName || '')
    if (input === null) return
    const trimmed = input.trim()
    if (!trimmed) return
    const [first, ...rest] = trimmed.split(' ')
    const last = rest.join(' ')
    setSavingName(true)
    try {
      await patchMe({ first_name: first, last_name: last || undefined })
      setOverrides((o) => ({ ...o, first_name: first, last_name: last }))
      toast.success('Name updated')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingName(false)
    }
  }

  function handleAvatarClick() {
    if (!uploadingAvatar) fileInputRef.current?.click()
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingAvatar(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Your session expired — please log in again.')

      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch(`${API_BASE}/uploads/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!uploadRes.ok) {
        let detail = 'Could not upload that image.'
        try {
          const body = await uploadRes.json()
          if (typeof body?.detail === 'string') detail = body.detail
        } catch { /* ignore json parse failures */ }
        throw new Error(detail)
      }
      const { url } = await uploadRes.json()

      await patchMe({ avatar_url: url })
      setOverrides((o) => ({ ...o, avatar_url: url }))
      toast.success('Photo updated')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleAddPhone() {
    const input = window.prompt('Enter your phone number', phone || '')
    if (input === null) return
    const trimmed = input.trim()
    setSavingPhone(true)
    try {
      await patchMe({ phone: trimmed })
      setOverrides((o) => ({ ...o, phone: trimmed }))
      toast.success('Phone updated')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingPhone(false)
    }
  }

  return (
    <DashboardLayout>
      <SEO title="Profile — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>My Profile</h1>
          <Button variant="secondary" size="sm" onClick={handleEditName} loading={savingName}>
            <PencilSimple size={16} /> Edit Profile
          </Button>
        </div>

        <div className={d.card} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={avatarUrl} name={fullName} size={80} />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <button
              onClick={handleAvatarClick}
              disabled={uploadingAvatar}
              title={uploadingAvatar ? 'Uploading…' : 'Change photo'}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--color-accent)', border: '2px solid var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingAvatar ? 'default' : 'pointer', color: 'var(--color-text-primary)', opacity: uploadingAvatar ? 0.6 : 1 }}
            >
              <Camera size={14} weight="bold" />
            </button>
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{fullName}</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{user?.email}</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
              Member since {new Date(user?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className={d.section}>
          <h3 className={d.sectionTitle}>Account Details</h3>
          <div className={d.settingsGroup}>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Email</div>
                <div className={d.settingsDesc}>{user?.email}</div>
              </div>
            </div>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Phone</div>
                <div className={d.settingsDesc}>{phone || 'Not set'}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleAddPhone} loading={savingPhone}>
                {phone ? 'Edit' : 'Add'}
              </Button>
            </div>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Location</div>
                <div className={d.settingsDesc}>Calgary, AB</div>
              </div>
              <Button variant="ghost" size="sm" disabled title="Not available yet">Coming soon</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
