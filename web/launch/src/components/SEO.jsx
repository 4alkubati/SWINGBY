import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'SwingBy'
const DEFAULT_DESC = 'SwingBy connects you with vetted local service businesses in Calgary. Post a job, get quotes, book with confidence.'
const DEFAULT_IMG = '/og-default.svg'

export default function SEO({ title, description, image, noindex, jsonLd }) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Local services, trusted and simple`
  const desc = description || DEFAULT_DESC
  const img = image || DEFAULT_IMG

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* OG */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
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
