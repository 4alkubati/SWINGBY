// Arabic has to LOOK Arabic, not just read Arabic — 2026-07-30.
//
// The app shipped a fully translated Arabic locale that rendered
// left-to-right, because nothing ever called I18nManager. These pin the two
// things that were actually wrong: the direction flag is never set, and the
// restart it requires is never performed.
//
// The subtle one is `forceRTL` semantics. It does not change the running UI —
// native reads layout direction once at process start — so a language switch
// that only re-renders leaves Arabic text inside a left-to-right layout. Every
// test here exists to stop that regressing quietly.
import { I18nManager } from 'react-native';

import {
  TEXT_END,
  applyDirection,
  directionMatches,
  restartApp,
  syncDirectionOnBoot,
} from '../rtl';

// jest-expo gives I18nManager REAL functions, not auto-mocks, so these have to
// be spied explicitly — `clearMocks` in jest.config.js resets spies but does
// not create them.
let allowSpy;
let forceSpy;

beforeEach(() => {
  I18nManager.isRTL = false;
  allowSpy = jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});
  forceSpy = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('applyDirection', () => {

  it('turns RTL on for Arabic and reports that a restart is owed', () => {
    const changed = applyDirection('ar');
    expect(forceSpy).toHaveBeenCalledWith(true);
    expect(changed).toBe(true);
  });

  it('always calls allowRTL, or forceRTL is silently ignored on iOS', () => {
    // The failure this prevents is the worst kind: forceRTL appears to work,
    // returns nothing, and the layout simply never flips.
    applyDirection('ar');
    expect(allowSpy).toHaveBeenCalledWith(true);
  });

  it('turns RTL off again when leaving Arabic', () => {
    I18nManager.isRTL = true;
    const changed = applyDirection('en');
    expect(forceSpy).toHaveBeenCalledWith(false);
    expect(changed).toBe(true);
  });

  it('does nothing and owes no restart when the direction already matches', () => {
    const changed = applyDirection('en'); // already LTR
    expect(forceSpy).not.toHaveBeenCalled();
    expect(changed).toBe(false);
  });

  it('treats fr-CA as left-to-right', () => {
    expect(applyDirection('fr-CA')).toBe(false);
  });

  it('matches on the base language, so ar-EG still flips', () => {
    expect(applyDirection('ar-EG')).toBe(true);
  });
});

describe('directionMatches', () => {
  it('is true for an LTR locale in an LTR app', () => {
    expect(directionMatches('en')).toBe(true);
  });

  it('is false for Arabic in an LTR app — the shipped bug', () => {
    expect(directionMatches('ar')).toBe(false);
  });
});

describe('syncDirectionOnBoot', () => {
  it('sets the flag', () => {
    syncDirectionOnBoot('ar');
    expect(forceSpy).toHaveBeenCalledWith(true);
  });

  it('never throws, because it runs inside i18n module init', () => {
    allowSpy.mockImplementationOnce(() => { throw new Error('native'); });
    expect(() => syncDirectionOnBoot('ar')).not.toThrow();
  });
});

describe('restartApp', () => {
  it('reports false rather than throwing when updates are disabled', async () => {
    // Expo Go and dev clients reject reloadAsync. A language picker that
    // crashes the app would be a worse bug than the one being fixed, so the
    // caller gets a boolean and shows "reopen the app" instead.
    jest.doMock('expo-updates', () => ({
      reloadAsync: () => Promise.reject(new Error('updates disabled')),
    }));
    await expect(restartApp()).resolves.toBe(false);
  });
});

describe('TEXT_END', () => {
  it('is the trailing edge for the direction the app booted in', () => {
    // RN's textAlign has no start/end, so this constant is the substitute.
    expect(['left', 'right']).toContain(TEXT_END);
    expect(TEXT_END).toBe(I18nManager.isRTL ? 'left' : 'right');
  });
});
