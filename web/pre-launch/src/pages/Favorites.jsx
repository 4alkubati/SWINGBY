import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Heart } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function Favorites() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title="Favorites — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>Favorites</h1>
        </div>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><Heart size={24} /></div>
          <h2 className={d.emptyTitle}>No favorites saved</h2>
          <p className={d.emptyDesc}>
            When you find a service provider you love, tap the heart icon to save them here for quick access next time.
          </p>
          <Button variant="primary" onClick={() => window.location.href = '/categories'}>Browse Services</Button>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
