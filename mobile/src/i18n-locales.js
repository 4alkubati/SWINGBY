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
