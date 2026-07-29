import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'SwingBy'
const SITE_URL = 'https://swingbyy.com'
const DEFAULT_DESC = 'SwingBy connects you with vetted local service businesses in Calgary. Post a job, get quotes, book with confidence.'
// PNG, not SVG. This was `/og-default.svg`, and no social crawler renders an
// SVG og:image — Facebook, Instagram, LinkedIn, WhatsApp and X all drop it and
// fall back to a bare link with no card.
const DEFAULT_IMG = '/og-image.png'

// og:image and og:url are resolved against nothing by the crawlers — a relative
// path is silently ignored, which is the second half of why the card never
// appeared. Everything social-facing goes out absolute.
const absolute = (p) => (/^https?:\/\//.test(p) ? p : `${SITE_URL}${p.startsWith('/') ? p : `/${p}`}`)

export default function SEO({ title, description, image, noindex, jsonLd, path }) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Local services, trusted and simple`
  const desc = description || DEFAULT_DESC
  const img = absolute(image || DEFAULT_IMG)
  const url = absolute(path || (typeof window !== 'undefined' ? window.location.pathname : '/'))

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {!noindex && <link rel="canonical" href={url} />}

      {/* OG */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  )
}
