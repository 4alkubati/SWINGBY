import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { GearSix, SignOut, Trash, ShieldCheck } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function AccountSettings() {
  const { t } = useTranslation()
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  if (loading) return <PageSkeleton />

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <DashboardLayout>
      <SEO title="Settings — SwingBy" />
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
              <Button variant="ghost" size="sm">Change</Button>
            </div>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Password</div>
                <div className={d.settingsDesc}>Last changed: Unknown</div>
              </div>
              <Button variant="ghost" size="sm">Update</Button>
            </div>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Language</div>
                <div className={d.settingsDesc}>English</div>
              </div>
              <Button variant="ghost" size="sm">Change</Button>
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
              <Button variant="ghost" size="sm">Enable</Button>
            </div>
          </div>
        </div>

        <div className={d.section} style={{ marginTop: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <Button variant="secondary" onClick={handleSignOut}>
              <SignOut size={16} /> {t('common.logout')}
            </Button>
            <Button variant="danger" size="sm">
              <Trash size={16} /> Delete Account
            </Button>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
