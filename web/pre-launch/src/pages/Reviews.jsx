import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Star } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function Reviews() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title="Reviews — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>My Reviews</h1>
        </div>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><Star size={24} /></div>
          <h2 className={d.emptyTitle}>No reviews yet</h2>
          <p className={d.emptyDesc}>
            After completing a booking, you can leave a review for your service provider. Your reviews help the community find great pros.
          </p>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
