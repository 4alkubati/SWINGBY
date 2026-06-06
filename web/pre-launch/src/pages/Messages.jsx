import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ChatText } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function Messages() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title="Messages — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>Messages</h1>
        </div>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><ChatText size={24} /></div>
          <h2 className={d.emptyTitle}>No messages yet</h2>
          <p className={d.emptyDesc}>
            When you start a booking, you can message your service provider directly here. All conversations are kept secure and private.
          </p>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
