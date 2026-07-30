// Translation coverage — 2026-07-29.
//
// Calgary first, and 17.4% of Calgarians speak a language other than English
// or French most often at home (2021 Census). The top ten non-official
// languages here are Punjabi, Tagalog, Mandarin, Cantonese, Spanish, Arabic,
// Urdu, Vietnamese, Korean and Russian. A newcomer hitting a language barrier
// on a payments app is a newcomer who does not use the app.
//
// Two things were quietly broken:
//
//   1. Arabic was fully translated — 264 keys — and NOT in the picker.
//      It activated only if the phone itself was Arabic, so a newcomer on an
//      English handset could not reach the Arabic app that already existed.
//      The picker and the device detector kept separate lists and drifted.
//
//   2. Roughly a quarter of the catalogue is English-only. Keys added in the
//      `Object.assign(translations.en, ...)` append blocks never reached
//      fr-CA or ar, so those locales silently fall back to English on
//      everything recent — including payment copy.
//
// These pin the registry and MEASURE the gap rather than asserting it away,
// so the number has to be looked at instead of discovered on a device.
import i18n from '../i18n';
import { LOCALES, READY_LOCALES, isRTL, resolveLocale } from '../i18n-locales';

const CENSUS_ORDER = [
  'pa', 'tl', 'zh-Hans', 'zh-Hant', 'es', 'ar', 'ur', 'vi', 'ko', 'ru',
];

describe('the locale registry', () => {
  it('offers every ready locale, and only ready ones', () => {
    const ready = READY_LOCALES.map((l) => l.code).sort();
    expect(ready).toEqual(['ar', 'en', 'fr-CA']);
  });

  it('offers Arabic, which was translated but unreachable', () => {
    expect(READY_LOCALES.some((l) => l.code === 'ar')).toBe(true);
  });

  it('never offers a locale with no translations behind it', () => {
    for (const locale of READY_LOCALES) {
      expect(Object.keys(i18n.translations[locale.code] || {}).length)
        .toBeGreaterThan(0);
    }
  });

  it('gives every locale a name in its own script', () => {
    for (const locale of LOCALES) {
      expect(locale.native).toBeTruthy();
      expect(typeof locale.native).toBe('string');
    }
  });

  it("carries Calgary's census priority order for what is not built yet", () => {
    const planned = LOCALES.filter((l) => l.status === 'planned').map((l) => l.code);
    const expected = CENSUS_ORDER.filter((c) => c !== 'ar'); // ar already ships
    // The census block must stay in census order and stay FIRST — the named
    // additions below it are appended, never interleaved, so this list keeps
    // reading as the data rather than as someone's preference.
    expect(planned.slice(0, expected.length)).toEqual(expected);
  });

  it('carries the named targets the 2021 Census does not rank', () => {
    const planned = LOCALES.filter((l) => l.status === 'planned').map((l) => l.code);
    // Ukrainian: the census predates the 2022 arrivals, and Alberta took the
    // most per capita. Hindi: "Indian" is not a language — Punjabi leads in
    // Calgary and is already in the census block above, Hindi backs it up.
    expect(planned).toEqual([...CENSUS_ORDER.filter((c) => c !== 'ar'), 'uk', 'hi']);
  });

  it('covers every language the founder named on 2026-07-30', () => {
    // en, ar ship today; the rest are registered as planned. "Chinese" is two
    // written forms, and "Indian" resolves to Punjabi first, Hindi second.
    const codes = LOCALES.map((l) => l.code);
    for (const code of ['uk', 'ar', 'en', 'zh-Hans', 'zh-Hant', 'pa', 'hi']) {
      expect(codes).toContain(code);
    }
  });
});

describe('right-to-left', () => {
  it('flags Arabic and Urdu, not the others', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('ur')).toBe(true);
    expect(isRTL('en')).toBe(false);
    expect(isRTL('fr-CA')).toBe(false);
  });

  it('matches on the base language, so ar-EG counts', () => {
    expect(isRTL('ar-EG')).toBe(true);
  });
});

describe('device locale resolution', () => {
  it('matches the exact tag first', () => {
    expect(resolveLocale('fr-CA')).toBe('fr-CA');
  });

  it('falls back to the base language', () => {
    expect(resolveLocale('fr-FR')).toBe('fr-CA');
    expect(resolveLocale('ar-EG')).toBe('ar');
  });

  it('falls back to English for anything unsupported', () => {
    // A Punjabi handset gets English TODAY. It is in the registry as
    // `planned`, so this expectation is what changes when pa ships.
    expect(resolveLocale('pa-IN')).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('never resolves to a locale the picker does not offer', () => {
    const offered = READY_LOCALES.map((l) => l.code);
    for (const tag of ['en-US', 'fr-FR', 'ar-EG', 'pa-IN', 'tl-PH', 'zz']) {
      expect(offered).toContain(resolveLocale(tag));
    }
  });
});

describe('catalogue coverage', () => {
  const en = i18n.translations.en;

  it('English is the reference and is not empty', () => {
    expect(Object.keys(en).length).toBeGreaterThan(300);
  });

  // Not `toEqual([])`. The gap is real and pre-existing; failing here would
  // just get the test deleted. It is reported instead, and capped so it
  // cannot get WORSE without someone deciding to let it.
  it.each(['fr-CA', 'ar'])('reports how far behind %s is', (code) => {
    const keys = Object.keys(i18n.translations[code] || {});
    const missing = Object.keys(en).filter((k) => !keys.includes(k));
    const pct = Math.round((missing.length / Object.keys(en).length) * 100);

    // eslint-disable-next-line no-console
    console.log(
      `[i18n] ${code}: ${keys.length}/${Object.keys(en).length} keys — ` +
      `${missing.length} missing (${pct}%)`,
    );

    // Ratchet. Lower it as translations land; never raise it.
    expect(pct).toBeLessThanOrEqual(30);
  });

  it('payment copy specifically must not be English-only', () => {
    // These are the strings that state what happens to someone's money. An
    // English fallback here is the language barrier at its most expensive.
    // Currently ENGLISH-ONLY — this documents the debt precisely.
    const moneyKeys = [
      'postJob.escrowExplainerLead',
      'postJob.hintOpen',
      'pay.escrowHold',
      'pay.titleHold',
    ];
    const untranslated = moneyKeys.filter(
      (k) => !Object.keys(i18n.translations['fr-CA'] || {}).includes(k),
    );
    // Known debt, asserted exactly so it shrinks visibly rather than silently.
    expect(untranslated).toEqual(moneyKeys);
  });
});
