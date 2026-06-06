import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ArrowLeft, ChatText } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function MessageThread() {
  const { t } = useTranslation()
  const { bookingId } = useParams()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title="Conversation — SwingBy" />
      <motion.div {...fadeUp}>
        <Link to="/messages" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Messages
        </Link>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><ChatText size={24} /></div>
          <h2 className={d.emptyTitle}>Conversation not found</h2>
          <p className={d.emptyDesc}>This conversation doesn't exist or the booking has ended.</p>
          <Link to="/messages"><Button variant="secondary">All Messages</Button></Link>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
