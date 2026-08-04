import styles from './DataVisual.module.css'

/**
 * Escrow payment flow, as `services/escrow.py` and `services/approvals.py`
 * actually implement it:
 *   Client pays 100% on ACCEPT → SwingBy holds ALL of it → nothing moves while
 *   the work happens → the client's approval (or 24h after the business marks
 *   it done) releases the whole balance minus the 10% platform cut.
 *   Business receives 90%. There is no staged release.
 *
 * This diagram used to draw a 50/50 staged release that the code has never
 * done. See backend/tests/test_no_staged_release_claim.py — that test exists
 * because this claim kept coming back, and it now covers this file.
 */
export default function PaymentFlowVisual() {
  return (
    <figure className={styles.visual} aria-labelledby="payflow-title">
      <h3 id="payflow-title" className={styles.title}>Where your money goes</h3>
      <p className={styles.subtitle}>
        Escrow protects both sides. SwingBy only takes a cut when the job is paid.
      </p>

      <svg
        viewBox="0 0 720 280"
        className={styles.svg}
        role="img"
        aria-label="Payment flow: client pays 100%, SwingBy holds it in escrow, and the full amount is released on the client's approval minus the 10% platform fee. Business receives 90% in total."
      >
        <defs>
          <marker id="arrow-pay" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#7a8492" />
          </marker>
        </defs>

        {/* Client */}
        <g>
          <rect x="20" y="100" width="130" height="70" rx="10" fill="#1a1f25" stroke="#2a323d" />
          <text x="85" y="130" textAnchor="middle" fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="700">Client pays</text>
          <text x="85" y="152" textAnchor="middle" fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="13">$100</text>
        </g>
        <line x1="150" y1="135" x2="200" y2="135" stroke="#7a8492" strokeWidth="2" markerEnd="url(#arrow-pay)" />

        {/* SwingBy escrow */}
        <g>
          <rect x="205" y="80" width="150" height="110" rx="12" fill="#0c1014" stroke="#3d6cff" strokeWidth="2" />
          <text x="280" y="108" textAnchor="middle" fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="700">SwingBy escrow</text>
          <text x="280" y="130" textAnchor="middle" fill="#3d6cff" fontFamily="Inter, sans-serif" fontSize="18" fontWeight="700">Holds 100%</text>
          <text x="280" y="155" textAnchor="middle" fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="11">until you approve</text>
          <text x="280" y="173" textAnchor="middle" fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="11">Bank-held, not on platform</text>
        </g>

        {/* While the work happens — nothing moves. This box is the whole point. */}
        <line x1="355" y1="110" x2="430" y2="60" stroke="#7a8492" strokeWidth="2" markerEnd="url(#arrow-pay)" />
        <g>
          <rect x="430" y="20" width="270" height="80" rx="10" fill="#1a1f25" stroke="#2a323d" />
          <text x="445" y="46" fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="700">WHILE THE WORK HAPPENS</text>
          <text x="445" y="68" fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="700">Still held — $0 released</text>
          <text x="445" y="87" fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="12">The business has none of it yet</text>
        </g>

        {/* Approval — the ONLY release event */}
        <line x1="355" y1="160" x2="430" y2="210" stroke="#7a8492" strokeWidth="2" markerEnd="url(#arrow-pay)" />
        <g>
          <rect x="430" y="170" width="270" height="90" rx="10" fill="#0e1f12" stroke="#3aa467" />
          <text x="445" y="196" fill="#7ee2a4" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="700">EVENT — You approve the work</text>
          <text x="445" y="218" fill="#e6e9ef" fontFamily="Inter, sans-serif" fontSize="14" fontWeight="700">$100 released – 10% fee</text>
          <text x="445" y="237" fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="12">Business gets $90 · SwingBy keeps $10</text>
          <text x="445" y="253" fill="#9aa3b0" fontFamily="Inter, sans-serif" fontSize="12">Auto-releases 24h after they mark it done</text>
        </g>
      </svg>

      <div className={styles.legend}>
        <div className={styles.legendItem}><span className={styles.swatch} style={{ background: '#3d6cff' }} /><span><strong>Escrow</strong> — SwingBy never spends your money. It sits between you and the business.</span></div>
        <div className={styles.legendItem}><span className={styles.swatch} style={{ background: '#3aa467' }} /><span><strong>Release event</strong> — there is only one. Your approval releases the whole amount, minus the 10% fee.</span></div>
      </div>

      <p className={styles.footnote}>
        Cancellations: a client who cancels more than 48 hours ahead is refunded in full. Within 48 hours the business keeps 25%; after the scheduled time, 50%. If the business cancels, the client is refunded in full at any notice.
      </p>
    </figure>
  )
}
