import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Briefcase, Plus } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function BusinessServices() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title="Services — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>Services</h1>
          <Button variant="primary" size="sm"><Plus size={16} /> Add Service</Button>
        </div>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><Briefcase size={24} /></div>
          <h2 className={d.emptyTitle}>No services listed</h2>
          <p className={d.emptyDesc}>
            Add the services your business offers. Include descriptions, pricing, and estimated duration to help clients choose you.
          </p>
          <Button variant="primary"><Plus size={16} /> Add First Service</Button>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
