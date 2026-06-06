import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ChartLineUp, CurrencyDollar } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function BusinessEarnings() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const [period, setPeriod] = useState('This Month')

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title="Earnings — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>Earnings</h1>
          <div className={d.tabBar} style={{ marginBottom: 0, borderBottom: 'none' }}>
            {['This Week', 'This Month', 'This Year', 'All Time'].map((p) => (
              <button key={p} className={`${d.tab} ${period === p ? d.tabActive : ''}`} onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
        </div>

        <div className={d.kpiRow}>
          <div className={d.kpi}>
            <div className={d.kpiLabel}>Total Earnings</div>
            <div className={`${d.kpiValue} ${d.kpiValueSuccess}`}>$0.00</div>
          </div>
          <div className={d.kpi}>
            <div className={d.kpiLabel}>Pending Payout</div>
            <div className={d.kpiValue}>$0.00</div>
          </div>
          <div className={d.kpi}>
            <div className={d.kpiLabel}>Completed Jobs</div>
            <div className={d.kpiValue}>0</div>
          </div>
        </div>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><ChartLineUp size={24} /></div>
          <h2 className={d.emptyTitle}>No earnings yet</h2>
          <p className={d.emptyDesc}>
            Complete jobs to start earning. Your earnings breakdown and payout history will appear here.
          </p>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
