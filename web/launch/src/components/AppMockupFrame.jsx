import styles from './AppMockupFrame.module.css'

/**
 * Phone-shaped frame for app screenshots. When `src` is missing,
 * renders a labeled SVG placeholder so layout never shifts when
 * real screenshots are dropped in later.
 *
 * Props:
 *   src        — image URL (optional)
 *   alt        — alt text (required)
 *   label      — placeholder caption shown when src is missing
 *   width      — px (default 280)
 *   tone       — 'dark' | 'light' (placeholder background)
 */
export default function AppMockupFrame({
  src,
  alt,
  label = 'Screenshot pending',
  width = 280,
  tone = 'dark',
}) {
  const aspect = 2.16 // iPhone 14 Pro ~ 19.5:9
  const height = Math.round(width * aspect / 1)
  const innerW = width - 20
  const innerH = height - 20
  return (
    <figure className={styles.frame} style={{ width, height }} aria-label={alt}>
      <span className={styles.notch} aria-hidden="true" />
      <div className={styles.screen} style={{ width: innerW, height: innerH }}>
        {src ? (
          <img src={src} alt={alt} loading="lazy" className={styles.img} />
        ) : (
          <svg
            viewBox={`0 0 ${innerW} ${innerH}`}
            className={styles.placeholder}
            role="img"
            aria-label={`${label} — ${alt}`}
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={tone === 'dark' ? '#1a1f25' : '#eef1f5'} />
                <stop offset="100%" stopColor={tone === 'dark' ? '#0c1014' : '#dde2eb'} />
              </linearGradient>
            </defs>
            <rect width={innerW} height={innerH} fill={`url(#grad-${label})`} />
            <rect
              x={16}
              y={48}
              width={innerW - 32}
              height={28}
              rx={8}
              fill={tone === 'dark' ? '#262d36' : '#cdd5e0'}
            />
            <rect x={16} y={92} width={innerW - 80} height={14} rx={4} fill={tone === 'dark' ? '#262d36' : '#cdd5e0'} />
            <rect x={16} y={114} width={innerW - 120} height={14} rx={4} fill={tone === 'dark' ? '#1f252c' : '#dde3ec'} />
            <rect x={16} y={150} width={innerW - 32} height={120} rx={12} fill={tone === 'dark' ? '#1a1f25' : '#e5eaf2'} />
            <rect x={16} y={290} width={innerW - 32} height={120} rx={12} fill={tone === 'dark' ? '#1a1f25' : '#e5eaf2'} />
            <text
              x={innerW / 2}
              y={innerH / 2}
              textAnchor="middle"
              fill={tone === 'dark' ? '#5a6573' : '#8a93a3'}
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={14}
              fontWeight={600}
            >
              {label}
            </text>
          </svg>
        )}
      </div>
    </figure>
  )
}
