import { Component } from 'react'
import { Sentry } from '../lib/sentry'
import styles from './ErrorBoundary.module.css'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    Sentry?.captureException?.(error, { extra: info })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrapper}>
          <h2 className={styles.title}>Something went wrong</h2>
          <p className={styles.desc}>Refresh the page or contact support if the problem persists.</p>
          <button className={styles.btn} onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
