import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './en.json'
import fr from './fr.json'
import ar from './ar.json'

// This app shipped English only, with `lng: 'en'` hard-coded and just `en` in
// resources, while mobile and web/launch both carried EN/FR/AR. Every string
// was already routed through t() — 282 call sites across 42 files — so the
// translations were the only missing piece, not the wiring.
//
// Detection order mirrors web/launch so a visitor who picks a language on one
// property gets it on the other: an explicit choice in localStorage wins,
// otherwise the browser's own preference.

const SUPPORTED = ['en', 'fr', 'ar']
const RTL = new Set(['ar'])

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

// Arabic without dir="rtl" is not "slightly off" — the page reads backwards,
// punctuation lands on the wrong side and any layout with a start/end axis
// mirrors incorrectly. Neither web app set it, which meant the Arabic locale
// web/launch already shipped was effectively unusable. `lang` matters too: it
// drives screen-reader pronunciation and font selection.
function applyDirection(lng) {
  if (typeof document === 'undefined') return
  const base = (lng || 'en').split('-')[0]
  document.documentElement.lang = base
  document.documentElement.dir = RTL.has(base) ? 'rtl' : 'ltr'
}

applyDirection(i18n.resolvedLanguage || i18n.language)
i18n.on('languageChanged', applyDirection)

export default i18n
