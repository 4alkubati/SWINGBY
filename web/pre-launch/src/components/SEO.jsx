import { Helmet } from 'react-helmet-async'

export default function SEO({ title, description, og, twitter, jsonLd, canonical }) {
  const siteTitle = 'SwingBy'
  const fullTitle = title ? `${title} — ${siteTitle}` : siteTitle

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
      {og?.image && <meta property="og:image" content={og.image} />}
      {og?.url && <meta property="og:url" content={og.url} />}

      <meta name="twitter:card" content={twitter?.card || 'summary_large_image'} />
      <meta name="twitter:title" content={twitter?.title || fullTitle} />
      {(twitter?.description || description) && (
        <meta name="twitter:description" content={twitter?.description || description} />
      )}
      {(twitter?.image || og?.image) && (
        <meta name="twitter:image" content={twitter?.image || og?.image} />
      )}

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  )
}
