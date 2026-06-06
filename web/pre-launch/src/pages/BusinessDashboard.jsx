import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ChartLineUp, UsersThree, Briefcase, Star, Clock } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function BusinessDashboard() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  const name = user?.user_metadata?.first_name || user?.email?.split('@')[0] || ''

  return (
    <DashboardLayout>
      <SEO title="Business Dashboard — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <div>
            <h1 className={d.title}>{t('dashboard.welcome', { name })}</h1>
            <p className={d.subtitle}>Manage your business on SwingBy</p>
          </div>
        </div>

        <div className={d.kpiRow}>
          <div className={d.kpi}>
            <div className={d.kpiLabel}>Total Earnings</div>
            <div className={`${d.kpiValue} ${d.kpiValueSuccess}`}>$0.00</div>
          </div>
          <div className={d.kpi}>
            <div className={d.kpiLabel}>Active Jobs</div>
            <div className={d.kpiValue}>0</div>
          </div>
          <div className={d.kpi}>
            <div className={d.kpiLabel}>Rating</div>
            <div className={`${d.kpiValue} ${d.kpiValueAccent}`}>—</div>
          </div>
          <div className={d.kpi}>
            <div className={d.kpiLabel}>Response Time</div>
            <div className={d.kpiValue}>—</div>
          </div>
        </div>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><Briefcase size={24} /></div>
          <h2 className={d.emptyTitle}>No jobs yet</h2>
          <p className={d.emptyDesc}>
            When clients book your services, they will appear here. Make sure your profile and services are set up to start receiving jobs.
          </p>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
