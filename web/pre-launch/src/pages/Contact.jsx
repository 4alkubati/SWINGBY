import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { PaperPlaneTilt, EnvelopeSimple, Clock } from '@phosphor-icons/react'
import SEO from '../components/SEO'
import Button from '../components/Button'
import shared from './page.module.css'
import s from './Contact.module.css'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0, 0, 0.2, 1] },
}

function buildSchema(t) {
  return z.object({
    name: z.string().min(1, t('contact.nameRequired')),
    email: z.string().min(1, t('contact.emailRequired')).email(t('contact.emailInvalid')),
    topic: z.string().min(1, t('contact.topicRequired')),
    message: z.string().min(10, t('contact.messageMin')),
  })
}

const TOPICS = [
  'contact.topicGeneral',
  'contact.topicSupport',
  'contact.topicBusiness',
  'contact.topicPress',
  'contact.topicFeedback',
]

const API_BASE = import.meta.env.VITE_API_URL || 'https://swingbyy-api.onrender.com'

async function submitContactForm(data) {
  const res = await fetch(`${API_BASE}/contact/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    let detail = 'Could not send your message. Please try again.'
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch { /* ignore json parse failures */ }
    throw new Error(detail)
  }
  return res.json()
}

export default function Contact() {
  const { t } = useTranslation()
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(buildSchema(t)),
    defaultValues: { name: '', email: '', topic: '', message: '' },
  })

  const onSubmit = async (data) => {
    try {
      await submitContactForm(data)
      toast.success(t('contact.success'))
      setSubmitted(true)
      reset()
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  return (
    <>
      <SEO
        title={t('contact.title')}
        description="Have a question or feedback? Contact the SwingBy team. We'd love to hear from you."
        og={{ url: 'https://swingbyy.com/contact' }}
      />

      {/* Hero */}
      <section className={shared.heroSection}>
        <motion.div {...fadeUp}>
          <h1 className={shared.heroTitle}>{t('contact.title')}</h1>
          <p className={shared.heroSubtitle}>{t('contact.subtitle')}</p>
        </motion.div>
      </section>

      <div className={s.container}>
        <div className={s.layout}>
          {/* Form */}
          <motion.div className={s.formWrap} {...fadeUp}>
            <form onSubmit={handleSubmit(onSubmit)} className={s.form} noValidate>
              <div className={s.field}>
                <label htmlFor="contact-name" className={s.label}>
                  {t('contact.name')}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  className={`${s.input} ${errors.name ? s.inputError : ''}`}
                  {...register('name')}
                />
                {errors.name && <span className={s.error}>{errors.name.message}</span>}
              </div>

              <div className={s.field}>
                <label htmlFor="contact-email" className={s.label}>
                  {t('contact.email')}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  className={`${s.input} ${errors.email ? s.inputError : ''}`}
                  {...register('email')}
                />
                {errors.email && <span className={s.error}>{errors.email.message}</span>}
              </div>

              <div className={s.field}>
                <label htmlFor="contact-topic" className={s.label}>
                  {t('contact.topic')}
                </label>
                <select
                  id="contact-topic"
                  className={`${s.select} ${errors.topic ? s.inputError : ''}`}
                  {...register('topic')}
                >
                  <option value="">{t('contact.topic')}</option>
                  {TOPICS.map((key) => (
                    <option key={key} value={t(key)}>{t(key)}</option>
                  ))}
                </select>
                {errors.topic && <span className={s.error}>{errors.topic.message}</span>}
              </div>

              <div className={s.field}>
                <label htmlFor="contact-message" className={s.label}>
                  {t('contact.message')}
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  className={`${s.textarea} ${errors.message ? s.inputError : ''}`}
                  {...register('message')}
                />
                {errors.message && <span className={s.error}>{errors.message.message}</span>}
              </div>

              <Button type="submit" size="lg" loading={isSubmitting} className={s.submitBtn}>
                <PaperPlaneTilt size={18} weight="bold" /> {t('contact.send')}
              </Button>

              {submitted && (
                <motion.p
                  className={s.successMsg}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {t('contact.success')}
                </motion.p>
              )}
            </form>
          </motion.div>

          {/* Info Sidebar */}
          <motion.aside className={s.sidebar} {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
            <h3 className={s.sidebarTitle}>{t('contact.infoTitle')}</h3>

            <div className={s.infoItem}>
              <EnvelopeSimple size={20} weight="regular" className={s.infoIcon} />
              <div>
                <span className={s.infoLabel}>{t('contact.email')}</span>
                <a href={`mailto:${t('contact.infoEmail')}`} className={s.infoValue}>
                  {t('contact.infoEmail')}
                </a>
              </div>
            </div>

            <div className={s.infoItem}>
              <Clock size={20} weight="regular" className={s.infoIcon} />
              <div>
                <span className={s.infoLabel}>Hours</span>
                <span className={s.infoValue}>{t('contact.infoHours')}</span>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </>
  )
}
