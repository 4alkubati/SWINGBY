import styles from './DataVisual.module.css'

/**
 * Finding a job (business side).
 * Feed preview: nearby jobs sorted by distance + recency.
 * Pricing transparency: 10% only when paid, no subscription, no per-quote fee.
 */
export default function FindJobVisual() {
  return (
    <figure className={styles.visual} aria-labelledby="findjob-title">
      <h3 id="findjob-title" className={styles.title}>Finding a job to quote</h3>
      <p className={styles.subtitle}>
        Real Calgary jobs sorted by distance and recency. Tap to quote — no per-quote fee, no subscription.
      </p>

      <svg
        viewBox="0 0 720 360"
        className={styles.svg}
        role="img"
        aria-label="Nearby jobs feed showing three example posts with distance and recency, plus a transparent pricing card explaining the 10% only-when-paid commission."
      >
        <rect x="20" y="20" width="430" height="320" rx="14" fill="#0c1014" stroke="#2a323d" />
        <text x="44" y="56" fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="700">Nearby jobs</text>
        <text x="44" y="76" fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="12">Calgary · 12 open posts within 15 km</text>

        {[
          { y: 96, title: 'Leaky kitchen tap', meta: '$150–$300 · 1.2 km · 4 min ago', cat: 'Plumbing' },
          { y: 174, title: 'Two-room interior paint', meta: '$600–$1,200 · 3.4 km · 22 min ago', cat: 'Painting' },
          { y: 252, title: 'Lawn cleanup + hedges', meta: '$120–$220 · 5.1 km · 1 hr ago', cat: 'Landscaping' },
        ].map((j) => (
          <g key={j.title}>
            <rect x={44} y={j.y} width={382} height={66} rx={10} fill="#161b22" stroke="#2a323d" />
            <text x={60} y={j.y + 22} fill="#3d6cff" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700">{j.cat.toUpperCase()}</text>
            <text x={60} y={j.y + 42} fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="700">{j.title}</text>
            <text x={60} y={j.y + 58} fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="12">{j.meta}</text>
            <rect x={328} y={j.y + 16} width={84} height={32} rx={6} fill="#3d6cff" />
            <text x={370} y={j.y + 37} textAnchor="middle" fill="#ffffff" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="700">Quote</text>
          </g>
        ))}

        {/* Pricing card */}
        <rect x={478} y={20} width={222} height={320} rx={14} fill="#0e1622" stroke="#3d6cff" />
        <text x={498} y={50} fill="#a8c0ff" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700">PRICING IS SIMPLE</text>
        <text x={498} y={86} fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="32" fontWeight="700">10%</text>
        <text x={498} y={110} fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="13">when you get paid</text>

        <line x1={498} y1={130} x2={680} y2={130} stroke="#2a323d" />
        <text x={498} y={156} fill="#7ee2a4" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="700">✓ No subscription</text>
        <text x={498} y={180} fill="#7ee2a4" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="700">✓ No per-quote fee</text>
        <text x={498} y={204} fill="#7ee2a4" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="700">✓ No setup cost</text>
        <text x={498} y={228} fill="#7ee2a4" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="700">✓ Cancel anytime</text>

        <rect x={498} y={260} width={182} height={42} rx={8} fill="#3d6cff" />
        <text x={589} y={286} textAnchor="middle" fill="#ffffff" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="700">Start quoting</text>
      </svg>

      <p className={styles.footnote}>
        We charge the 10% out of the second half of the escrow release on completion. The first half is yours, in full, on confirmation.
      </p>
    </figure>
  )
}
