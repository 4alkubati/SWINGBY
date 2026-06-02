import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import styles from './LegalPage.module.css'

const LAST_UPDATED = 'May 2025'

const SECTIONS = [
  {
    id: 'use-of-platform',
    title: '1. Use of the Platform',
    body: `By creating an account on SwingBy, you agree to use the platform only for lawful purposes. You must be at least 18 years old to create an account.

Clients ("users") may post service requests and accept quotes from service providers. Service providers ("businesses") may submit quotes and complete booked jobs through the platform.

You agree not to: misrepresent your identity or credentials, post fraudulent job listings or quotes, attempt to circumvent the platform's payment system, or engage in harassment or abusive behaviour toward other users.

SwingBy reserves the right to suspend or terminate accounts that violate these terms.`,
  },
  {
    id: 'payments-escrow-refunds',
    title: '2. Payments, Escrow & Refunds',
    body: `All payments on SwingBy are processed through our payment partner. When a client accepts a quote, payment is held in escrow until the job is marked complete by the service provider and photo proof is submitted.

Payment is automatically released to the service provider upon job completion. In cases of dispute, SwingBy may hold payment pending investigation.

Refunds: if a job is cancelled before it begins, a full refund will be issued. If a dispute arises after work has started, SwingBy will review submitted evidence (photos, messages) and make a final determination.

SwingBy charges a platform fee on each completed transaction. This fee is disclosed at the time of booking.`,
  },
  {
    id: 'disclaimers-liability',
    title: '3. Disclaimers & Limitation of Liability',
    body: `SwingBy is a marketplace that connects clients with independent service providers. We do not employ service providers, and we are not responsible for the quality, safety, legality, or completion of services performed.

We verify business licenses where indicated by a "Verified" badge, but verification does not constitute an endorsement or guarantee of service quality.

To the maximum extent permitted by law, SwingBy's liability for any claim arising from your use of the platform is limited to the amount you paid for the relevant transaction.

These terms are governed by the laws of Alberta, Canada, consistent with the Alberta Consumer Protection Act and applicable federal law. For questions, contact legal@swingbyy.com`,
  },
]

/**
 * Parses a body string into paragraphs and bullet lists.
 * Lines starting with "• " are grouped into <ul> elements.
 */
function SectionBody({ text }) {
  const lines = text.split('\n')
  const nodes = []
  let bulletBuffer = []

  function flushBullets() {
    if (bulletBuffer.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}`} className={styles.sectionList}>
        {bulletBuffer.map((item, i) => (
          <li key={i} className={styles.sectionListItem}>{item}</li>
        ))}
      </ul>
    )
    bulletBuffer = []
  }

  lines.forEach((line, i) => {
    if (line.startsWith('• ')) {
      bulletBuffer.push(line.slice(2))
    } else {
      flushBullets()
      if (line.trim() !== '') {
        nodes.push(
          <p key={`p-${i}`} className={styles.sectionParagraph}>{line}</p>
        )
      }
    }
  })
  flushBullets()

  return <div className={styles.sectionBody}>{nodes}</div>
}

export default function TermsPage() {
  return (
    <div className={styles.page} id="top">
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>SwingBy</Link>
      </nav>

      <div className={styles.contentWrapper}>
        {/* Table of contents — desktop sticky sidebar */}
        <aside className={styles.toc} aria-label="Table of contents">
          <p className={styles.tocLabel}>On this page</p>
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={styles.tocLink}
            >
              {section.title}
            </a>
          ))}
        </aside>

        <main className={styles.main}>
          <h1 className={styles.docTitle}>Terms of Service</h1>
          <p className={styles.docMeta}>Last updated: {LAST_UPDATED}</p>
          <p className={styles.docIntro}>
            Please read these Terms of Service carefully before using SwingBy. By accessing or using our platform, you agree to be bound by these terms.
          </p>

          {SECTIONS.map((section) => (
            <div
              className={styles.section}
              key={section.id}
              id={section.id}
            >
              <h2 className={styles.sectionHeading}>{section.title}</h2>
              <SectionBody text={section.body} />
            </div>
          ))}

          {/* Back to top */}
          <div className={styles.backToTop}>
            <a href="#top" className={styles.backToTopLink}>
              ↑ Back to top
            </a>
          </div>

          <div className={styles.contactCard}>
            <p className={styles.contactTitle}>Legal questions?</p>
            <p className={styles.contactBody}>
              Email{' '}
              <a href="mailto:legal@swingbyy.com" className={styles.contactLink}>legal@swingbyy.com</a>
              {' '}or{' '}
              <a href="mailto:4alkubati@gmail.com" className={styles.contactLink}>4alkubati@gmail.com</a>
            </p>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}
