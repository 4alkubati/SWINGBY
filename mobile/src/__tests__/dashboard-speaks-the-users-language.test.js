// The business dashboard rendered English literals in every locale.
//
// SB-0007. The walkthrough screenshot shows "Good evening" and "THIS WEEK" in
// English sitting directly above "НАСТУПНА РОБОТА" and "ГРОШІ В РУСІ" — one
// screen, two languages. The obvious reading is a missing translation, and it
// was not: 911fd92 had already taken uk from 468 to 763 keys, and all four
// locales are 763/763 today.
//
// The English half never went through i18n at all. `getGreeting()` returned the
// literal 'Good evening'; EarningsHero's eyebrow was the literal text THIS WEEK
// in the JSX. A missing translation and a literal that never asks for one look
// identical on the screen and are opposite defects — the first is a dictionary
// gap, the second is a call site. Key-coverage tests can only ever catch the
// first, which is why this shipped with the dictionary at 100%.
//
// So this asserts both halves:
//   1. no locale is missing a key any other locale has (the gap), and
//   2. the dashboard files contain no user-visible English literals (the
//      call sites), which is the half that actually shipped.

import fs from 'fs';
import path from 'path';

import i18n from '../i18n';

const SRC = path.join(__dirname, '..');

describe('every locale carries every key', () => {
  const locales = Object.keys(i18n.translations);

  it('has the same key set in all four locales', () => {
    const union = new Set(locales.flatMap((l) => Object.keys(i18n.translations[l])));
    for (const loc of locales) {
      const missing = [...union].filter((k) => !(k in i18n.translations[loc]));
      expect({ locale: loc, missing }).toEqual({ locale: loc, missing: [] });
    }
  });

  it('translates the dashboard keys rather than copying English through', () => {
    const en = i18n.translations.en;
    const dashKeys = Object.keys(en).filter((k) => k.startsWith('dashboard.'));
    expect(dashKeys.length).toBeGreaterThan(10);

    for (const loc of locales) {
      if (loc === 'en') continue;
      const copied = dashKeys.filter((k) => i18n.translations[loc][k] === en[k]);
      // 'avis' is legitimately both singular and plural in French, so a small
      // number of identical values is expected; a wholesale copy is not.
      expect({ locale: loc, copied }).toEqual({ locale: loc, copied: [] });
    }
  });
});

describe('the dashboard has no English baked into it', () => {
  // Text a user reads, written as a literal instead of a key. Deliberately
  // narrow: it looks for prose in the two places SB-0007 actually hid — bare
  // text between JSX tags, and string literals handed to a text-bearing prop.
  const FILES = [
    'screens/business/DashboardScreen.js',
    'components/EarningsHero.js',
  ];

  function strip(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  }

  it.each(FILES)('%s renders no bare English between JSX tags', (rel) => {
    const src = strip(fs.readFileSync(path.join(SRC, rel), 'utf8'));
    // Two or more words starting with a capital, sitting as raw JSX text.
    const found = [...src.matchAll(/>\s*([A-Z][a-zA-Z]+(?:\s+[a-zA-Z]+){1,8})\s*</g)]
      .map((m) => m[1].trim());
    expect(found).toEqual([]);
  });

  it.each(FILES)('%s passes no English string literal to a text prop', (rel) => {
    const src = strip(fs.readFileSync(path.join(SRC, rel), 'utf8'));
    const found = [...src.matchAll(/(?:sub|label|title|placeholder)\s*=\s*\{?\s*'([A-Za-z][^']{3,60})'/g)]
      .map((m) => m[1]);
    expect(found).toEqual([]);
  });

  it('never returns a hardcoded greeting', () => {
    const src = strip(fs.readFileSync(path.join(SRC, FILES[0]), 'utf8'));
    expect(src).not.toMatch(/return\s+'Good (morning|afternoon|evening)'/);
    expect(src).toContain('dashboard.greetingEvening');
  });
});
