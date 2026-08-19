// The Settings language chip must name the language the app is actually in.
//
// It did not, twice. D-W1 (2026-08-13) fixed the STALENESS half — the chip
// snapshotted `i18n.locale` at mount, before the async restore settled, so it
// froze on the constructor default. That fix (911fd92) made it subscribe.
//
// The FORMATTER half survived untouched into the 2026-08-15 preview build:
//
//     {currentLocale === 'fr-CA' ? 'FR' : 'EN'}
//
// A two-way ternary against FOUR status:'ready' locales. Arabic and Ukrainian
// both fell to the else branch and rendered "EN" while the app rendered their
// script — so the single control that tells a user what language they are in
// asserted the opposite. A newcomer pinned to Ukrainian saw a chip reading EN
// and had no way to name the problem, which is exactly how it got reported as
// "the app is broken" rather than "the language is wrong" (SB-0008).
//
// No test could catch it because none existed: the chip is presentation, and
// presentation was assumed cosmetic. It was not — it was the only diagnostic
// the user had.
//
// This asserts the property that actually matters: EVERY offered locale gets a
// distinct, correct chip. It fails the moment someone promotes a locale to
// 'ready' and the chip cannot represent it.

import fs from 'fs';
import path from 'path';

import { LOCALES, READY_LOCALES, localeChipLabel } from '../i18n-locales';

describe('the Settings locale chip', () => {
  it('names every locale offered in the picker', () => {
    const expected = { en: 'EN', 'fr-CA': 'FR', ar: 'AR', uk: 'UK' };
    for (const { code } of READY_LOCALES) {
      expect(localeChipLabel(code)).toBe(expected[code]);
    }
  });

  it('never labels a non-English locale as EN', () => {
    for (const { code } of READY_LOCALES) {
      if (code === 'en') continue;
      expect(localeChipLabel(code)).not.toBe('EN');
    }
  });

  it('gives every ready locale a chip nothing else shares', () => {
    const chips = READY_LOCALES.map((l) => localeChipLabel(l.code));
    expect(new Set(chips).size).toBe(chips.length);
  });

  it('can represent every locale on the roadmap, not just the ready ones', () => {
    // The failure mode this guards is promoting a locale to 'ready' and
    // forgetting the chip — which is the bug, one status field later.
    for (const { code } of LOCALES) {
      const chip = localeChipLabel(code);
      expect(chip).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('falls back to EN rather than rendering empty or undefined', () => {
    for (const bad of [undefined, null, '']) {
      expect(localeChipLabel(bad)).toBe('EN');
    }
  });

  // The tests above pass just as happily if SettingsScreen goes back to
  // hardcoding the ternary — the helper would still be correct, and unused.
  // Since re-hardcoding IS the regression, assert the call site too.
  it('is what SettingsScreen actually renders — no hardcoded locale ternary', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'shared', 'SettingsScreen.js'),
      'utf8',
    );
    expect(src).toContain('localeChipLabel');
    // Any comparison of a locale against a bare quoted code in a ternary is the
    // shape that shipped the bug. Comments are stripped first so the note
    // explaining the history does not trip its own guard.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const { code: locale } of LOCALES) {
      expect(code).not.toMatch(
        new RegExp(`===\\s*['"\`]${locale}['"\`][\\s\\S]{0,40}\\?`),
      );
    }
  });
});
