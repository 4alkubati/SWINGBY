/**
 * D-W1 — the app shipped rendering Ukrainian under a Settings row reading "EN".
 *
 * Walkthrough 2026-08-13, screenshots 08 and 09. Not a missing translation:
 * English was present and correct for every affected key. The mechanism was a
 * race with no observer.
 *
 *   1. `i18n.locale` is restored from SecureStore, which is async, inside a
 *      fire-and-forget IIFE at module import.
 *   2. Consumers read `i18n.locale` SYNCHRONOUSLY into `useState` at mount,
 *      which happens first, capturing the constructor default 'en'.
 *   3. The real locale then settled to whatever was persisted ('uk'), and
 *      nothing told the UI. The chip said EN forever.
 *   4. Ukrainian carries 468 keys; the app uses more, so the remainder fell
 *      back to English — producing a half-translated screen that looks like a
 *      broken build rather than a wrong setting.
 *
 * The whole class is "async state with no notification", so these tests pin the
 * NOTIFIER rather than any one screen. A future screen that snapshots the
 * locale is still free to be wrong, but the mechanism it needs now exists and
 * is proven to fire.
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-CA' }],
  locale: 'en-CA',
}));

describe('locale change notifier', () => {
  let i18n;
  let onLocaleChange;
  let setLocale;
  let localeReady;

  beforeEach(async () => {
    jest.resetModules();
    const mod = require('../i18n');
    i18n = mod.default;
    onLocaleChange = mod.onLocaleChange;
    setLocale = mod.setLocale;
    localeReady = mod.localeReady;
    await localeReady;
  });

  it('exposes localeReady, so callers can wait instead of guessing', async () => {
    expect(localeReady).toBeInstanceOf(Promise);
    await expect(localeReady).resolves.toBeTruthy();
  });

  it('notifies subscribers when the locale changes', async () => {
    const seen = [];
    onLocaleChange((l) => seen.push(l));
    await setLocale('fr-CA');
    expect(seen).toContain('fr-CA');
  });

  it('unsubscribes cleanly', async () => {
    const seen = [];
    const off = onLocaleChange((l) => seen.push(l));
    off();
    await setLocale('ar');
    expect(seen).toHaveLength(0);
  });

  it('a throwing subscriber cannot take the app down', async () => {
    onLocaleChange(() => {
      throw new Error('boom');
    });
    const seen = [];
    onLocaleChange((l) => seen.push(l));
    await expect(setLocale('en')).resolves.toBeDefined();
    expect(seen).toContain('en');
  });

  it('the settled locale is observable — the bug was that it was not', async () => {
    // Before the fix there was no way to learn the locale had changed after
    // boot, which is precisely why the Settings chip could disagree with the
    // rendered strings.
    let observed = null;
    onLocaleChange((l) => {
      observed = l;
    });
    await setLocale('uk');
    expect(observed).toBe('uk');
    expect(i18n.locale).toBe('uk');
    expect(observed).toBe(i18n.locale); // the invariant the UI depends on
  });
});
