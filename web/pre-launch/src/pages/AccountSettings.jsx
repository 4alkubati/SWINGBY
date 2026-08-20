import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { GearSix, SignOut, Trash, ShieldCheck } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

// These are real, auth-protected routes, not mockups — so a button here that
// renders enabled and does nothing is worse than no button. Self-serve email
// change, 2FA and language switching are not built on this surface; they are
// disabled and labelled rather than left as live-looking chrome.
//
// The two paths that DO exist are wired properly:
//   * password  — Supabase sends a reset email (auth goes straight to Supabase
//                 on pre-launch; there is no FastAPI account API here).
//   * deletion  — no self-serve delete exists on any web surface. PrivacyPage
//                 publishes privacy@swingbyy.com as the way to exercise it
//                 under PIPEDA / Alberta PIPA, so that is where this points.
export default function AccountSettings() {
  const { t } = useTranslation()
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)

  if (loading) return <PageSkeleton />

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  async function handlePasswordReset() {
    if (!user?.email || resetting) return
    setResetting(true)
    try {
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setResetSent(true)
    } finally {
      setResetting(false)
    }
  }

  return (
    <DashboardLayout>
      <SEO title="Settings — SwingByy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>Account Settings</h1>
        </div>

        <div className={d.section}>
          <h3 className={d.sectionTitle}>General</h3>
          <div className={d.settingsGroup}>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Email</div>
                <div className={d.settingsDesc}>{user?.email}</div>
              </div>
              <Button variant="ghost" size="sm" disabled title="Not available yet">Coming soon</Button>
            </div>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Password</div>
                <div className={d.settingsDesc}>
                  {resetSent ? 'Reset link sent — check your email.' : 'Send yourself a reset link'}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handlePasswordReset} loading={resetting} disabled={resetSent}>
                {resetSent ? 'Sent' : 'Send reset link'}
              </Button>
            </div>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Language</div>
                <div className={d.settingsDesc}>English</div>
              </div>
              <Button variant="ghost" size="sm" disabled title="Not available yet">Coming soon</Button>
            </div>
          </div>
        </div>

        <div className={d.section}>
          <h3 className={d.sectionTitle}>Security</h3>
          <div className={d.settingsGroup}>
            <div className={d.settingsItem}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <ShieldCheck size={20} style={{ color: 'var(--color-text-secondary)' }} />
                <div>
                  <div className={d.settingsLabel}>Two-factor authentication</div>
                  <div className={d.settingsDesc}>Add an extra layer of security to your account</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" disabled title="Not available yet">Coming soon</Button>
            </div>
          </div>
        </div>

        <div className={d.section} style={{ marginTop: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <Button variant="secondary" onClick={handleSignOut}>
              <SignOut size={16} /> {t('common.logout')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => { window.location.href = 'mailto:privacy@swingbyy.com?subject=Account%20deletion%20request' }}
            >
              <Trash size={16} /> Delete Account
            </Button>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
