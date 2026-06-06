import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ArrowLeft, CalendarBlank } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function BookingDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title={`Booking #${id} — SwingBy`} />
      <motion.div {...fadeUp}>
        <Link to="/bookings" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Bookings
        </Link>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><CalendarBlank size={24} /></div>
          <h2 className={d.emptyTitle}>Booking not found</h2>
          <p className={d.emptyDesc}>This booking doesn't exist or you don't have access to view it.</p>
          <Link to="/bookings"><Button variant="secondary">View All Bookings</Button></Link>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
