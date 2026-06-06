import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { User, Camera, PencilSimple } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import Avatar from '../components/Avatar'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function Profile() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  const meta = user?.user_metadata || {}
  const fullName = meta.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : user?.email

  return (
    <DashboardLayout>
      <SEO title="Profile — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>My Profile</h1>
          <Button variant="secondary" size="sm"><PencilSimple size={16} /> Edit Profile</Button>
        </div>

        <div className={d.card} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={fullName} size={80} />
            <button style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--color-accent)', border: '2px solid var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
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
                <div className={d.settingsDesc}>Not set</div>
              </div>
              <Button variant="ghost" size="sm">Add</Button>
            </div>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Location</div>
                <div className={d.settingsDesc}>Calgary, AB</div>
              </div>
              <Button variant="ghost" size="sm">Edit</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
