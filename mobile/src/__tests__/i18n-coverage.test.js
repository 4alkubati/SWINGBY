/**
 * i18n-coverage.test.js — SB-0072.
 *
 * `i18n.js` carried two comments describing Arabic and French as untranslated
 * skeletons resolved "through the en fallback until they are translated". Both
 * had been false for some time: all three locales are at full parity.
 *
 * The comment was the symptom. The cause is that nothing measured coverage, so
 * the file's own description of itself could drift in either direction — and
 * did, in the direction that makes a reviewer think shipping ar/fr is still
 * blocked on translation work that is in fact done.
 *
 * This reads the source rather than importing the module, because importing
 * i18n.js pulls in expo-localization and react-native. The property under test
 * is textual anyway: does every key in `en` exist in every other locale.
 */
const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(path.join(__dirname, '..', 'i18n.js'), 'utf8')

function localeKeys() {
  const marks = [...SRC.matchAll(/^ {2}('?[a-zA-Z-]+'?):\s*\{/gm)].map((m) => ({
    locale: m[1].replace(/'/g, ''),
    index: m.index,
  }))
  const out = {}
  marks.forEach((mark, n) => {
    const end = n + 1 < marks.length ? marks[n + 1].index : SRC.length
    const body = SRC.slice(mark.index, end)
    out[mark.locale] = new Set(
      [...body.matchAll(/^ {4}'([^']+)':/gm)].map((m) => m[1]),
    )
  })
  return out
}

describe('i18n locale coverage', () => {
  const keys = localeKeys()

  it('finds the locales it expects to find', () => {
    expect(Object.keys(keys).sort()).toEqual(['ar', 'en', 'fr-CA'])
    expect(keys.en.size).toBeGreaterThan(200)
  })

  it.each(['fr-CA', 'ar'])('%s has every key en has', (locale) => {
    const missing = [...keys.en].filter((k) => !keys[locale].has(k))
    expect(missing).toEqual([])
  })

  it.each(['fr-CA', 'ar'])('%s has no key en does not have', (locale) => {
    // An orphan key is dead weight, and usually a rename that landed in one
    // locale only — which shows up as an untranslated string in the app.
    const orphans = [...keys[locale]].filter((k) => !keys.en.has(k))
    expect(orphans).toEqual([])
  })

  it('does not describe the translated locales as skeletons', () => {
    expect(SRC).not.toMatch(/skeleton keys, translator TODO/)
    expect(SRC).not.toMatch(/until they are translated\./)
  })
})
