import ContentLoader from 'react-content-loader'

export default function PageSkeleton() {
  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: 'var(--space-3xl) var(--space-lg)',
    }}>
      <ContentLoader
        speed={1.5}
        width="100%"
        height={400}
        viewBox="0 0 1200 400"
        backgroundColor="var(--color-surface)"
        foregroundColor="var(--color-surface-alt)"
      >
        <rect x="0" y="0" rx="12" ry="12" width="500" height="40" />
        <rect x="0" y="60" rx="8" ry="8" width="700" height="20" />
        <rect x="0" y="100" rx="8" ry="8" width="600" height="20" />
        <rect x="0" y="160" rx="20" ry="20" width="380" height="180" />
        <rect x="400" y="160" rx="20" ry="20" width="380" height="180" />
        <rect x="800" y="160" rx="20" ry="20" width="380" height="180" />
      </ContentLoader>
    </div>
  )
}
