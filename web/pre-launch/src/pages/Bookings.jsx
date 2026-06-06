import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CalendarBlank, FunnelSimple } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

const TABS = ['All', 'Upcoming', 'Completed', 'Cancelled']

export default function Bookings() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const [tab, setTab] = useState('All')

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title="Bookings — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>{t('dashboard.activeBookings')}</h1>
        </div>

        <div className={d.tabBar}>
          {TABS.map((t) => (
            <button key={t} className={`${d.tab} ${tab === t ? d.tabActive : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><CalendarBlank size={24} /></div>
          <h2 className={d.emptyTitle}>{t('dashboard.noBookings')}</h2>
          <p className={d.emptyDesc}>{t('dashboard.noBookingsDesc')}</p>
          <Button variant="primary" onClick={() => window.location.href = '/categories'}>Browse Services</Button>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
