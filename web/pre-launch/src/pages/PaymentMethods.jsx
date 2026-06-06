import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { CreditCard } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import DashboardLayout from '../components/DashboardLayout'
import Button from '../components/Button'
import { useAuth } from '../context/AuthContext'
import PageSkeleton from '../components/PageSkeleton'
import d from './DashboardPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

export default function PaymentMethods() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()

  if (loading) return <PageSkeleton />

  return (
    <DashboardLayout>
      <SEO title="Payment Methods — SwingBy" />
      <motion.div {...fadeUp}>
        <div className={d.header}>
          <h1 className={d.title}>Payment Methods</h1>
          <Button variant="primary" size="sm">Add Payment Method</Button>
        </div>

        <div className={d.emptyState}>
          <div className={d.emptyIcon}><CreditCard size={24} /></div>
          <h2 className={d.emptyTitle}>No payment methods</h2>
          <p className={d.emptyDesc}>
            Add a payment method to book services on SwingBy. We accept all major credit and debit cards.
          </p>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}
