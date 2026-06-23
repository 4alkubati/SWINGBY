import styles from './DataVisual.module.css'

/**
 * Posting a job (client side).
 * Form preview with required fields + the "5 minutes to your first quote" promise.
 * Response-time number is intentionally `--` until we have a real measurement.
 */
export default function PostJobVisual() {
  return (
    <figure className={styles.visual} aria-labelledby="postjob-title">
      <h3 id="postjob-title" className={styles.title}>Posting a job</h3>
      <p className={styles.subtitle}>
        Five fields, a couple of photos, you're done. Verified Calgary businesses see it instantly.
      </p>

      <svg
        viewBox="0 0 720 340"
        className={styles.svg}
        role="img"
        aria-label="Post a job form preview with five fields: category, address, budget, timing, and photos."
      >
        <rect x="20" y="20" width="680" height="300" rx="14" fill="#0c1014" stroke="#2a323d" />
        <text x="44" y="56" fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="700">Post a job</text>
        <text x="44" y="76" fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="12">Free for clients. No account needed to see quotes.</text>

        {[
          { y: 100, label: 'Category', value: 'Plumbing' },
          { y: 148, label: 'Address', value: '123 7th Ave SW, Calgary' },
          { y: 196, label: 'Budget', value: '$150 – $400' },
          { y: 244, label: 'Timing', value: 'Within 2 days' },
        ].map((f) => (
          <g key={f.label}>
            <text x={44} y={f.y} fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600">{f.label.toUpperCase()}</text>
            <rect x={44} y={f.y + 8} width={400} height={32} rx={6} fill="#161b22" stroke="#2a323d" />
            <text x={56} y={f.y + 29} fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="13">{f.value}</text>
          </g>
        ))}

        {/* Photos chip row */}
        <text x={44} y={290} fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600">PHOTOS (OPTIONAL)</text>
        <rect x={44} y={296} width={44} height={20} rx={4} fill="#161b22" stroke="#2a323d" />
        <text x={66} y={310} textAnchor="middle" fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="10">+ 3</text>

        {/* CTA */}
        <rect x={500} y={264} width={180} height={42} rx={8} fill="#3d6cff" />
        <text x={590} y={290} textAnchor="middle" fill="#ffffff" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="700">Post job · get quotes</text>

        {/* Sidebar promise */}
        <rect x={476} y={92} width={204} height={150} rx={10} fill="#0e1622" stroke="#3d6cff" />
        <text x={490} y={118} fill="#a8c0ff" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700">CALGARY PROMISE</text>
        <text x={490} y={146} fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="18" fontWeight="700">5 minutes</text>
        <text x={490} y={166} fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="12">to your first quote</text>
        <line x1={490} y1={180} x2={666} y2={180} stroke="#2a323d" />
        <text x={490} y={202} fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="11">Avg response time</text>
        <text x={490} y={224} fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="16" fontWeight="700">-- min</text>
        <text x={490} y={236} fill="#5e6776" fontFamily="Inter, sans-serif" fontSize="10">(tracked once beta cohort is live)</text>
      </svg>

      <p className={styles.footnote}>
        Your address is only shared with the business after you accept their quote.
      </p>
    </figure>
  )
}
