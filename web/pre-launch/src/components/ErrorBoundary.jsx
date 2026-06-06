import { Component } from 'react'
import { useTranslation } from 'react-i18next'

class ErrorBoundaryInner extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback({ onReload: this.handleReload })
    }
    return this.props.children
  }
}

function DefaultFallback({ onReload }) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: 'var(--space-xl)',
      textAlign: 'center',
    }}>
      <h1 className="heading-lg" style={{ marginBottom: 'var(--space-base)' }}>
        {t('errors.generic')}
      </h1>
      <p className="body-lg" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
        {t('errors.genericDesc')}
      </p>
      <button
        onClick={onReload}
        style={{
          padding: 'var(--space-md) var(--space-lg)',
          background: 'var(--color-accent-btn)',
          color: 'var(--color-text-primary)',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {t('common.retry')}
      </button>
    </div>
  )
}

export default function ErrorBoundary({ children, fallback }) {
  const renderFallback = fallback || ((props) => <DefaultFallback {...props} />)
  return (
    <ErrorBoundaryInner fallback={renderFallback}>
      {children}
    </ErrorBoundaryInner>
  )
}
