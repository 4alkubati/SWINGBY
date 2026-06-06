import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import SEO from '../components/SEO'
import l from './LegalPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

const SECTIONS = [
  {
    id: 'what-are-cookies',
    title: 'What are cookies?',
    body: 'Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and understand how you use it. SwingBy uses cookies to provide a better, more personalized experience.',
  },
  {
    id: 'cookies-we-use',
    title: 'Cookies we use',
    body: `We use the following types of cookies:

• Essential cookies — Required for the site to function. These handle authentication, security, and basic features. You cannot opt out of essential cookies.
• Analytics cookies — Help us understand how visitors use our site. We use Plausible Analytics, a privacy-focused analytics tool that does not use cookies for tracking by default.
• Preference cookies — Remember your settings like language and theme preferences.
• Marketing cookies — Currently, SwingBy does not use marketing or advertising cookies.`,
  },
  {
    id: 'third-party',
    title: 'Third-party cookies',
    body: 'We use Supabase for authentication, which may set cookies related to your login session. These are essential cookies required for the service to function. We do not use third-party advertising cookies.',
  },
  {
    id: 'managing-cookies',
    title: 'Managing cookies',
    body: 'You can control cookies through your browser settings. Most browsers allow you to block or delete cookies. However, blocking essential cookies may prevent you from using certain features of SwingBy. You can also manage your cookie preferences using our cookie banner.',
  },
  {
    id: 'updates',
    title: 'Updates to this policy',
    body: 'We may update this cookie policy from time to time. When we make changes, we will update the "Last updated" date at the top of this page. We encourage you to review this policy periodically.',
  },
]

export default function CookiesPage() {
  const { t } = useTranslation()

  return (
    <>
      <SEO title={`${t('legal.cookiesTitle')} — SwingBy`} />
      <motion.div className={l.page} {...fadeUp}>
        <nav className={l.nav}>
          <Link to="/" className={l.logo}>SwingBy</Link>
        </nav>
        <div className={l.contentWrapper}>
          <aside className={l.toc}>
            <span className={l.tocLabel}>On this page</span>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={l.tocLink}>{s.title}</a>
            ))}
          </aside>
          <main className={l.main}>
            <h1 className={l.docTitle}>{t('legal.cookiesTitle')}</h1>
            <p className={l.docMeta}>Last updated: June 1, 2026</p>
            <p className={l.docIntro}>
              This cookie policy explains how SwingBy uses cookies and similar technologies when you visit our website.
            </p>
            {SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className={l.section}>
                <h2 className={l.sectionHeading}>{section.title}</h2>
                <div className={l.sectionBody}>
                  {section.body.split('\n\n').map((para, i) => {
                    if (para.startsWith('•')) {
                      return (
                        <ul key={i} className={l.sectionList}>
                          {para.split('\n').filter(l => l.startsWith('•')).map((item, j) => (
                            <li key={j} className={l.sectionListItem}>{item.replace('• ', '')}</li>
                          ))}
                        </ul>
                      )
                    }
                    return <p key={i} className={l.sectionParagraph}>{para}</p>
                  })}
                </div>
              </section>
            ))}
            <section className={l.contactCard}>
              <h3 className={l.contactTitle}>Questions about cookies?</h3>
              <p className={l.contactBody}>
                Contact us at <a href="mailto:privacy@swingbyy.com" className={l.contactLink}>privacy@swingbyy.com</a>
              </p>
            </section>
          </main>
        </div>
      </motion.div>
    </>
  )
}
