import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import SEO from '../components/SEO'
import l from './LegalPage.module.css'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } }

const SECTIONS = [
  {
    id: 'commitment',
    title: 'Our commitment',
    body: 'SwingBy is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply the relevant accessibility standards to ensure we provide equal access to all users.',
  },
  {
    id: 'standards',
    title: 'Standards we follow',
    body: `We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA. These guidelines explain how to make web content more accessible to people with a wide range of disabilities, including:

• Visual impairments (blindness, low vision, color blindness)
• Hearing impairments
• Motor impairments
• Cognitive and learning disabilities`,
  },
  {
    id: 'features',
    title: 'Accessibility features',
    body: `SwingBy includes the following accessibility features:

• Keyboard navigation — All interactive elements are accessible via keyboard
• Screen reader support — Proper ARIA labels and semantic HTML throughout
• Skip to content — A skip navigation link for keyboard users
• Color contrast — All text meets WCAG AA contrast requirements
• Focus indicators — Clear, visible focus indicators on all interactive elements
• Responsive design — Content is accessible on all screen sizes
• Reduced motion — Respects the prefers-reduced-motion system setting
• Alt text — All meaningful images include descriptive alternative text`,
  },
  {
    id: 'known-issues',
    title: 'Known issues',
    body: 'We are currently in pre-launch and actively working to identify and fix accessibility issues. If you encounter any barriers, please let us know so we can address them promptly.',
  },
  {
    id: 'feedback',
    title: 'Feedback',
    body: 'We welcome your feedback on the accessibility of SwingBy. If you experience any difficulty accessing any part of our website, or have suggestions for improvement, please contact us. We take accessibility feedback seriously and will respond within 5 business days.',
  },
]

export default function AccessibilityPage() {
  const { t } = useTranslation()

  return (
    <>
      <SEO title={`${t('legal.accessibilityTitle')} — SwingBy`} />
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
            <h1 className={l.docTitle}>{t('legal.accessibilityTitle')}</h1>
            <p className={l.docMeta}>Last updated: June 1, 2026</p>
            <p className={l.docIntro}>
              SwingBy is committed to making our platform accessible to everyone.
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
              <h3 className={l.contactTitle}>Report an accessibility issue</h3>
              <p className={l.contactBody}>
                Email us at <a href="mailto:accessibility@swingbyy.com" className={l.contactLink}>accessibility@swingbyy.com</a> or use our <Link to="/contact" className={l.contactLink}>contact form</Link>.
              </p>
            </section>
          </main>
        </div>
      </motion.div>
    </>
  )
}
