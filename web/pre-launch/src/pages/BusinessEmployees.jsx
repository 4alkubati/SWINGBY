import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { UsersThree, Plus } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function BusinessEmployees() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title="Employees — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>Team Members</h1>
          <Button variant="primary" size="sm"><Plus size={16} /> Add Member</Button>
        </div>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><UsersThree size={24} /></div>
          <h2 className={d.emptyTitle}>No team members</h2>
          <p className={d.emptyDesc}>
            Add your employees and assign them to jobs. Manage roles, availability, and track their performance.
          </p>
          <Button variant="primary"><Plus size={16} /> Add First Member</Button>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
