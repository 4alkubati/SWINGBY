// The locales SwingBy ships, defined once.
//
// This existed in two places that disagreed. i18n.js's device detection knew
// about `ar`; LanguageSelector's list did not. The result: Arabic was fully
// translated — all 264 keys — and no user could choose it. It activated only
// if the phone itself was set to Arabic, so a newcomer holding an English
// handset had no way to reach the Arabic app that already existed.
//
// PRIORITY comes from the 2021 Census. 17.4% of Calgarians speak a language
// other than English or French most often AT HOME, and the top ten
// non-official languages here are, in order:
//
//   Punjabi, Tagalog, Mandarin, Cantonese, Spanish,
//   Arabic, Urdu, Vietnamese, Korean, Russian
//
// That is the roadmap. `status` says where each one actually is, because a
// half-translated locale offered in the picker is worse than one that is not:
// the user switches, gets an English app with a foreign menu, and cannot find
// their way back.
//
//   'ready'   — translated and offered in the picker.
//   'planned' — on the roadmap, NOT offered. Listed here so the priority
//               order is a fact in the codebase and not a memory.
//
// WHERE THIS LIST DEPARTS FROM THE CENSUS, AND WHY (founder call, 2026-07-30)
// The named target languages are Ukrainian, Arabic, English, Chinese and
// "Indian". Three notes, because two of those do not map onto a census row:
//
//   * UKRAINIAN is not in the 2021 top ten and is in this list anyway. The
//     census was taken BEFORE the 2022 displacement, and Alberta received more
//     Ukrainian arrivals per capita than any other province — a cohort that is
//     newly arrived, often without established English, and squarely the
//     "newcomer facing a language barrier" case this work exists for. Census
//     order is evidence, not scripture, and here it is simply out of date.
//   * "CHINESE" is two locales, not one. Mandarin and Cantonese are both large
//     in Calgary and they do not share a written form — Simplified for
//     Mandarin speakers, Traditional for most Cantonese speakers. Shipping one
//     and calling it "Chinese" leaves the other half reading a foreign script.
//   * "INDIAN" is not a language. In Calgary the relevant one is PUNJABI,
//     which is already the single largest non-official language in the city —
//     ahead of every other entry here. Hindi is added below it as the
//     second-most-likely fit, but if only one ships, it is Punjabi.
//
// Translation is deliberately not machine-generated in bulk. These strings
// carry payment terms, cancellation penalties and refund promises; a wrong
// word is the same class of defect as the "your budget is charged now" copy
// this app already had to pull.

export const LOCALES = [
  // ── Official languages ────────────────────────────────────────────────────
  {
    code: 'en',
    label: 'English',
    native: 'English',
    rtl: false,
    status: 'ready',
  },
  {
    code: 'fr-CA',
    label: 'French (Canada)',
    native: 'Français (Canada)',
    rtl: false,
    status: 'ready',
  },

  // ── Calgary's most-spoken non-official languages, in census order ─────────
  {
    code: 'pa',
    label: 'Punjabi',
    native: 'ਪੰਜਾਬੀ',
    rtl: false,
    status: 'planned',
  },
  {
    code: 'tl',
    label: 'Tagalog',
    native: 'Tagalog',
    rtl: false,
    status: 'planned',
  },
  {
    code: 'zh-Hans',
    label: 'Chinese (Simplified)',
    native: '简体中文',
    rtl: false,
    status: 'planned',
  },
  {
    code: 'zh-Hant',
    label: 'Chinese (Traditional)',
    native: '繁體中文',
    rtl: false,
    status: 'planned',
  },
  {
    code: 'es',
    label: 'Spanish',
    native: 'Español',
    rtl: false,
    status: 'planned',
  },
  {
    code: 'ar',
    label: 'Arabic',
    native: 'العربية',
    rtl: true,
    status: 'ready',
  },
  {
    code: 'ur',
    label: 'Urdu',
    native: 'اردو',
    rtl: true,
    status: 'planned',
  },
  {
    code: 'vi',
    label: 'Vietnamese',
    native: 'Tiếng Việt',
    rtl: false,
    status: 'planned',
  },
  {
    code: 'ko',
    label: 'Korean',
    native: '한국어',
    rtl: false,
    status: 'planned',
  },
  {
    code: 'ru',
    label: 'Russian',
    native: 'Русский',
    rtl: false,
    status: 'planned',
  },

  // ── Named targets that the 2021 Census does not rank ──────────────────────
  // Listed after the census block so the ordering above stays a faithful
  // record of the data, rather than being quietly edited to fit a preference.
  {
    code: 'uk',
    label: 'Ukrainian',
    native: 'Українська',
    rtl: false,
    // Shipped 2026-08-01 — all 468 keys, complete on arrival. `ready` is not a
    // plan, it is a claim that the app speaks this language everywhere, and
    // i18n-coverage fails the build if that stops being true.
    status: 'ready',
  },
  {
    code: 'hi',
    label: 'Hindi',
    native: 'हिन्दी',
    rtl: false,
    status: 'planned',
  },
];

/** The locales a user may actually pick. */
export const READY_LOCALES = LOCALES.filter((l) => l.status === 'ready');

/** Right-to-left locale codes, ready or not. */
export const RTL_CODES = LOCALES.filter((l) => l.rtl).map((l) => l.code);

/** Is this locale written right-to-left? Accepts 'ar' or 'ar-EG'. */
export function isRTL(code) {
  const base = String(code || '').split('-')[0];
  return RTL_CODES.some((rtl) => rtl.split('-')[0] === base);
}

/**
 * Best supported locale for a device language tag.
 *
 * Matches the exact tag first, then the base language, so an `ar-EG` handset
 * gets Arabic and `fr-FR` gets fr-CA. Falls back to English.
 */
export function resolveLocale(deviceTag) {
  const tag = String(deviceTag || '');
  const base = tag.split('-')[0].toLowerCase();
  if (!base) return 'en';

  const exact = READY_LOCALES.find(
    (l) => l.code.toLowerCase() === tag.toLowerCase(),
  );
  if (exact) return exact.code;

  const byBase = READY_LOCALES.find(
    (l) => l.code.split('-')[0].toLowerCase() === base,
  );
  return byBase ? byBase.code : 'en';
}
