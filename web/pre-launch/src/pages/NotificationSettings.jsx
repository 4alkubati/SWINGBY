import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Bell } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

const DEFAULT_NOTIFS = {
  bookingUpdates: true,
  messages: true,
  promotions: false,
  newsletter: true,
  pushNotifications: true,
  smsAlerts: false,
}

export default function NotificationSettings() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const [notifs, setNotifs] = useState(DEFAULT_NOTIFS)

  if (loading) return <PageSkeleton />

  function toggle(key) {
    setNotifs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const items = [
    { key: 'bookingUpdates', label: 'Booking updates', desc: 'Get notified about booking confirmations, changes, and reminders' },
    { key: 'messages', label: 'New messages', desc: 'Receive alerts when a service provider messages you' },
    { key: 'promotions', label: 'Promotions & offers', desc: 'Special deals and discounts from service providers' },
    { key: 'newsletter', label: 'SwingBy newsletter', desc: 'Monthly updates on new features, tips, and community stories' },
    { key: 'pushNotifications', label: 'Push notifications', desc: 'Real-time alerts on your device' },
    { key: 'smsAlerts', label: 'SMS alerts', desc: 'Text message notifications for urgent updates' },
  ]

  return (
    <DashboardLayout>
      <SEO title="Notification Settings — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>Notifications</h1>
        </div>

        <div className={d.settingsGroup}>
          {items.map((item) => (
            <div key={item.key} className={d.settingsItem}>
              <div>
                <div className={d.settingsLabel}>{item.label}</div>
                <div className={d.settingsDesc}>{item.desc}</div>
              </div>
              <button className={`${d.toggle} ${notifs[item.key] ? d.toggleOn : ''}`} onClick={() => toggle(item.key)} aria-label={`Toggle ${item.label}`}>
                <div className={d.toggleKnob} />
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
