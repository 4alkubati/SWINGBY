import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from '../locales/en.json'
import fr from '../locales/fr.json'
import ar from '../locales/ar.json'

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
    supportedLngs: ['en', 'fr', 'ar'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

// Arabic without dir="rtl" is not "slightly off" — the page reads backwards and
// any layout with a start/end axis mirrors incorrectly. This app has shipped an
// ar.json since before 2026-08, with nothing ever setting direction, so the
// Arabic locale was effectively unusable. `lang` matters too: it drives
// screen-reader pronunciation and font selection.
const RTL = new Set(['ar'])

function applyDirection(lng) {
  if (typeof document === 'undefined') return
  const base = (lng || 'en').split('-')[0]
  document.documentElement.lang = base
  document.documentElement.dir = RTL.has(base) ? 'rtl' : 'ltr'
}

applyDirection(i18n.resolvedLanguage || i18n.language)
i18n.on('languageChanged', applyDirection)

export default i18n
