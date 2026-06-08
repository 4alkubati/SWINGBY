import SEO from '../components/SEO'
import styles from './page.module.css'

export default function About() {
  return (
    <>
      <SEO title="About" description="SwingBy is a Calgary-based marketplace connecting clients with vetted local service businesses." />
      <div className={styles.container}>
        <div className={styles.pageHero}>
          <h1 className={styles.pageTitle}>About SwingBy</h1>
          <p className={styles.pageSubtitle}>The trust layer for local services.</p>
        </div>
        <div className={styles.section}>
          <div style={{ maxWidth: '720px', margin: '0 auto' }} className={styles.prose}>
            <p>SwingBy is a Calgary-based marketplace that connects people who need services with the local businesses that provide them. We built it because the existing options were fragmented, opaque, and often one-sided.</p>
            <p>Too many homeowners spend hours searching for trades online, calling around, and dealing with no-shows. Too many good small businesses never reach the clients who would hire them today if they could just find them.</p>
            <p>SwingBy fixes this. Clients post what they need. Businesses express interest and quote. Escrow protects payment. Reviews build trust. The whole loop is in one place — transparent, fair, and simple.</p>
            <h2>Our values</h2>
            <ul>
              <li><strong>Trust first.</strong> Every design decision filters through: does this make the transaction safer?</li>
              <li><strong>Fair to both sides.</strong> Clients get protection. Businesses get real leads. We don't favour one at the expense of the other.</li>
              <li><strong>Local is real.</strong> We care about Calgary specifically. We know the neighbourhoods, the trades, the culture. Growth doesn't mean abandoning depth.</li>
              <li><strong>Simple beats complex.</strong> If it takes more than three steps, we've failed.</li>
            </ul>
            <h2>Built in Calgary</h2>
            <p>We're based in Calgary, Alberta. The team that built this grew up here. We know which trades are in demand and which ones are hard to find. We built SwingBy for ourselves first, and then for you.</p>
          </div>
        </div>
      </div>
    </>
  )
}
