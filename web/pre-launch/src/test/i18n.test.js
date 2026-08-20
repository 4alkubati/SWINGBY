/**
 * i18n.test.js — the three ways a translation ships broken.
 *
 * This app shipped English only while mobile and web/launch both carried
 * EN/FR/AR. Every string was already routed through t(), so nothing looked
 * wrong — a missing locale is invisible until someone switches to it, which is
 * exactly why it survived.
 *
 * Each case here corresponds to something that was actually wrong, not a
 * hypothetical:
 *
 *   1. PARITY — a key missing from fr/ar silently falls back to English, so a
 *      half-translated page looks fine to whoever wrote it.
 *   2. PLACEHOLDERS — {{name}} dropped in translation renders a sentence with a
 *      hole in it, and only in the language the author does not read.
 *   3. DIRECTION — ar.json shipped in web/launch for weeks with nothing setting
 *      dir="rtl" (SB-0090), so Arabic rendered left-to-right and was unusable.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const LOCALES = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'locales')

function flatten(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') Object.assign(acc, flatten(v, key))
    else acc[key] = v
    return acc
  }, {})
}

const load = (l) => flatten(JSON.parse(readFileSync(resolve(LOCALES, `${l}.json`), 'utf8')))
const en = load('en')
const TRANSLATIONS = readdirSync(LOCALES)
  .filter((f) => f.endsWith('.json') && f !== 'en.json')
  .map((f) => f.replace('.json', ''))

describe('locale coverage', () => {
  it('ships more than English', () => {
    expect(TRANSLATIONS.sort()).toEqual(['ar', 'fr'])
  })

  it.each(TRANSLATIONS)('%s has every key en has', (locale) => {
    const missing = Object.keys(en).filter((k) => !(k in load(locale)))
    expect(missing).toEqual([])
  })

  it.each(TRANSLATIONS)('%s has no key en does not have', (locale) => {
    // An orphan is usually a rename applied in one locale only — it shows up as
    // an untranslated string in the app, not as an error.
    const orphans = Object.keys(load(locale)).filter((k) => !(k in en))
    expect(orphans).toEqual([])
  })

  it.each(TRANSLATIONS)('%s preserves every {{placeholder}}', (locale) => {
    const t = load(locale)
    const names = (s) => (String(s).match(/{{(\w+)}}/g) || []).sort()
    const broken = Object.keys(en).filter(
      (k) => names(en[k]).join() !== names(t[k]).join(),
    )
    expect(broken).toEqual([])
  })

  it.each(TRANSLATIONS)('%s is actually translated, not copied', (locale) => {
    // Proper nouns, email addresses and the neighbourhood list are legitimately
    // identical. A large identical count means somebody copied en.json.
    const t = load(locale)
    const identical = Object.keys(en).filter((k) => en[k] === t[k])
    expect(identical.length).toBeLessThan(Object.keys(en).length * 0.1)
  })
})

describe('text direction (SB-0090)', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => {
    document.documentElement.removeAttribute('dir')
    document.documentElement.removeAttribute('lang')
    localStorage.clear()
  })

  it('sets rtl for Arabic', async () => {
    localStorage.setItem('i18nextLng', 'ar')
    const { default: i18n } = await import('../locales/i18n.js')
    await i18n.changeLanguage('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
  })

  it.each(['en', 'fr'])('sets ltr for %s', async (lng) => {
    const { default: i18n } = await import('../locales/i18n.js')
    await i18n.changeLanguage(lng)
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.lang).toBe(lng)
  })

  it('switches direction back when leaving Arabic', async () => {
    const { default: i18n } = await import('../locales/i18n.js')
    await i18n.changeLanguage('ar')
    expect(document.documentElement.dir).toBe('rtl')
    await i18n.changeLanguage('en')
    expect(document.documentElement.dir).toBe('ltr')
  })
})
