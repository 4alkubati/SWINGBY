import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ShieldCheck } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

const DEFAULT_PRIVACY = {
  profileVisible: true,
  showLocation: true,
  showReviews: true,
  analyticsTracking: true,
  personalizedAds: false,
}

export default function PrivacySettings() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY)

  if (loading) return <PageSkeleton />

  function toggle(key) {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const items = [
    { key: 'profileVisible', label: 'Profile visibility', desc: 'Allow service providers to view your profile when you post a job' },
    { key: 'showLocation', label: 'Show location', desc: 'Display your general area on your profile' },
    { key: 'showReviews', label: 'Public reviews', desc: 'Allow your reviews to be visible to other users' },
    { key: 'analyticsTracking', label: 'Usage analytics', desc: 'Help us improve SwingBy by sharing anonymous usage data' },
    { key: 'personalizedAds', label: 'Personalized recommendations', desc: 'Receive service recommendations based on your activity' },
  ]

  return (
    <DashboardLayout>
      <SEO title="Privacy Settings — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>Privacy & Data</h1>
        </div>

        <div className={d.settingsGroup}>
          {items.map((item) => (
            <div key={item.key} className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>{item.label}</div>
                <div className={d.settingsDesc}>{item.desc}</div>
              </div>
              <button className={`${d.toggle} ${privacy[item.key] ? d.toggleOn : ''}`} onClick={() => toggle(item.key)} aria-label={`Toggle ${item.label}`}>
                <div className={d.toggleKnob} />
              </button>
            </div>
          ))}
        </div>

        <div className={d.section} style={{ marginTop: 'var(--space-xl)' }}>
          <h3 className={d.sectionTitle}>Your Data</h3>
          <div className={d.settingsGroup}>
            <div className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>Download your data</div>
                <div className={d.settingsDesc}>Get a copy of all data associated with your account</div>
              </div>
              <Button variant="ghost" size="sm">Request</Button>
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
