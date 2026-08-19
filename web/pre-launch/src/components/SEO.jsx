import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://swingbyy.com'

// Social crawlers do not resolve a relative og:image — they drop it and render a
// bare link. Callers pass "/og-image.png"; it goes out absolute.
const absolute = (p) =>
  !p || /^https?:\/\//.test(p) ? p : `${SITE_URL}${p.startsWith('/') ? p : `/${p}`}`

export default function SEO({ title, description, og, twitter, jsonLd, canonical }) {
  const siteTitle = 'SwingByy'  // §0: two y's, capital B. 'SwingByy' is the dead name.
  const fullTitle = title ? `${title} — ${siteTitle}` : siteTitle
  const ogImage = absolute(og?.image)
  const twImage = absolute(twitter?.image) || ogImage

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {canonical && <link rel="canonical" href={canonical} />}

      <meta property="og:title" content={og?.title || fullTitle} />
      {(og?.description || description) && (
        <meta property="og:description" content={og?.description || description} />
      )}
      <meta property="og:type" content={og?.type || 'website'} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {og?.url && <meta property="og:url" content={og.url} />}

      <meta name="twitter:card" content={twitter?.card || 'summary_large_image'} />
      <meta name="twitter:title" content={twitter?.title || fullTitle} />
      {(twitter?.description || description) && (
        <meta name="twitter:description" content={twitter?.description || description} />
      )}
      {twImage && <meta name="twitter:image" content={twImage} />}

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  )
}
