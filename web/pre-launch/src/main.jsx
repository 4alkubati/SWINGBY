import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './theme/reset.css'
import './theme/tokens.css'
import './theme/typography.css'
import './index.css'
import './locales/i18n'
import { initSentry } from './lib/sentry'
import App from './App'

initSentry()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
)
